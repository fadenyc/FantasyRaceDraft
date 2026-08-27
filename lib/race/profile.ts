import { mulberry32 } from "../fairness/prng";

/**
 * Builds each runner's entire position(t) curve once, deterministically, from
 * the seed — everything downstream (live rendering, replay, the results
 * table) samples this curve rather than re-deriving motion from scratch.
 * That's what keeps live view and replay pixel-identical, and what makes a
 * page reload mid-race resync instantly from elapsed time alone with no
 * accumulated drift, even after the tab was backgrounded.
 *
 * The curve is NOT built by literally integrating velocity frame-by-frame
 * in real time (that would make position path-dependent on frame timing,
 * breaking replay determinism). Instead each runner's motion is precomputed
 * once as a dense sample table via a one-time numerical integration over a
 * normalized [0,1] timeline, then rescaled so it lands exactly on position
 * 1 at its assigned finish time — deterministic, replayable, and still
 * capable of looking like a real, surging, occasionally-stalling sprint.
 */

export interface RaceConfig {
  durationMs: number;
  minStartDelayMs: number;
  maxStartDelayMs: number;
  /** Earliest any runner can finish, as a fraction of durationMs — keeps the whole pack in play through this point. */
  packFinishStartFraction: number;
  /** Minimum time between consecutive ranks' finish times, so order is never ambiguous. */
  finishGapMinMs: number;
  surgeCount: number;
  /** Velocity never drops below this fraction of baseline — a "stall" slows a runner, it never freezes them. */
  minVelocityFloor: number;
  integrationSteps: number;
}

export const DEFAULT_RACE_CONFIG: RaceConfig = {
  durationMs: 60_000,
  minStartDelayMs: 20,
  maxStartDelayMs: 120,
  packFinishStartFraction: 0.78,
  finishGapMinMs: 700,
  surgeCount: 3,
  minVelocityFloor: 0.25,
  integrationSteps: 240,
};

export interface RunnerSample {
  /** 0..1 along the track. */
  position: number;
  /** Position units per ms — for lean/bob/streak/sprite-cadence, not for display. */
  velocity: number;
}

export interface RunnerProfile {
  teamId: string;
  /** 0-indexed final rank from finalOrder. Internal only — never render this before the runner actually finishes. */
  rank: number;
  startDelayMs: number;
  finishTimeMs: number;
  sample: (elapsedMs: number) => RunnerSample;
}

export interface RaceProfileSet {
  runners: RunnerProfile[];
  config: RaceConfig;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/** Strictly increasing finish times, spread and jittered but never closer together than finishGapMinMs. */
function buildFinishTimes(teamCount: number, config: RaceConfig, rng: () => number): number[] {
  const base = config.durationMs * config.packFinishStartFraction;
  const span = config.durationMs - base;

  const times: number[] = [];
  for (let rank = 0; rank < teamCount; rank++) {
    const evenFraction = teamCount <= 1 ? 0 : rank / (teamCount - 1);
    const jitter = (rng() - 0.5) * span * 0.12;
    times.push(base + evenFraction * span + jitter);
  }

  for (let i = 1; i < times.length; i++) {
    if (times[i] < times[i - 1] + config.finishGapMinMs) {
      times[i] = times[i - 1] + config.finishGapMinMs;
    }
  }
  // Clamp the tail back inside the race duration if jitter pushed it out.
  const overflow = times[times.length - 1] - config.durationMs;
  if (overflow > 0) {
    for (let i = 0; i < times.length; i++) times[i] -= overflow;
  }

  return times;
}

interface Surge {
  center: number; // fraction of the runner's own journey (0..1)
  width: number;
  strength: number; // positive = burst of speed, negative = stall
}

function buildSurges(rng: () => number, count: number): Surge[] {
  return Array.from({ length: count }, () => ({
    center: 0.12 + rng() * 0.7, // never right at the very end — the finish approach stays decisive
    width: 0.08 + rng() * 0.1,
    strength: (rng() - 0.32) * 0.9, // biased toward bursts, occasional stall
  }));
}

/** One runner's full curve: a dense table integrated once, then rescaled to land exactly at position 1 at finishTimeMs. */
function buildRunnerCurve(
  rng: () => number,
  startDelayMs: number,
  finishTimeMs: number,
  config: RaceConfig,
): (elapsedMs: number) => RunnerSample {
  const runDuration = finishTimeMs - startDelayMs;
  const surges = buildSurges(rng, config.surgeCount);
  const steps = config.integrationSteps;

  const rawVelocity = new Float64Array(steps + 1);
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    let v = 1;
    for (const s of surges) {
      const d = (u - s.center) / s.width;
      v += s.strength * Math.exp(-d * d);
    }
    rawVelocity[i] = Math.max(config.minVelocityFloor, v);
  }

  const rawPosition = new Float64Array(steps + 1);
  for (let i = 1; i <= steps; i++) {
    rawPosition[i] = rawPosition[i - 1] + ((rawVelocity[i - 1] + rawVelocity[i]) / 2) * (1 / steps);
  }
  const total = rawPosition[steps];

  return (elapsedMs: number): RunnerSample => {
    if (elapsedMs <= startDelayMs) return { position: 0, velocity: 0 };
    if (elapsedMs >= finishTimeMs) return { position: 1, velocity: 0 };

    const u = (elapsedMs - startDelayMs) / runDuration;
    const idxF = u * steps;
    const idx = Math.floor(idxF);
    const frac = idxF - idx;
    const nextIdx = Math.min(idx + 1, steps);

    const pos0 = rawPosition[idx] / total;
    const pos1 = rawPosition[nextIdx] / total;
    const vel0 = rawVelocity[idx] / total;
    const vel1 = rawVelocity[nextIdx] / total;

    return {
      position: clamp01(pos0 + (pos1 - pos0) * frac),
      velocity: (vel0 + (vel1 - vel0) * frac) / runDuration,
    };
  };
}

/**
 * Builds the full deterministic race — one curve per team. Cheap enough
 * (a few hundred float ops per runner) to call once per race and hold in a
 * ref; never call this from inside a render loop.
 */
export function buildRaceProfileSet(
  seed: number,
  finalOrder: readonly string[],
  config: RaceConfig = DEFAULT_RACE_CONFIG,
): RaceProfileSet {
  const masterRng = mulberry32(seed >>> 0);
  const finishTimes = buildFinishTimes(finalOrder.length, config, masterRng);

  const runners: RunnerProfile[] = finalOrder.map((teamId, rank) => {
    // Distinct, deterministic RNG stream per runner so each looks independent.
    const runnerRng = mulberry32((seed + rank * 7_919 + 104_729) >>> 0);
    const startDelayMs =
      config.minStartDelayMs + runnerRng() * (config.maxStartDelayMs - config.minStartDelayMs);
    const finishTimeMs = finishTimes[rank];

    return {
      teamId,
      rank,
      startDelayMs,
      finishTimeMs,
      sample: buildRunnerCurve(runnerRng, startDelayMs, finishTimeMs, config),
    };
  });

  return { runners, config };
}
