import { mulberry32 } from "../fairness/prng";

/**
 * Pure animation logic shared by the live race view and the replay view.
 * The only difference between "live" and "replay" is where `elapsedMs`
 * comes from (see components/race/useElapsedClock.ts) — the actual
 * positions are always a pure function of (seed, finalOrder, elapsedMs),
 * so a replay is guaranteed to look identical to what happened live.
 */

export const RACE_DURATION_MS = 60_000;

export interface RacePosition {
  teamId: string;
  /** 0..1 along the track. 1 = crossed the finish line. */
  progress: number;
  finished: boolean;
  /** 0-indexed final rank; 0 = 1st pick. */
  rank: number;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/**
 * Decelerating, but blended with a small linear term so a racer never looks
 * frozen right before finishing. Pure cubic ease-out's tail is nearly flat
 * (its derivative approaches 0), and since the last-place racer's own
 * finish time lines up with the very end of the whole race, that flat tail
 * is exactly what viewers are staring at during the race's climax — it
 * reads as "stuck," not "almost done." The linear floor keeps it visibly
 * moving the whole way in.
 */
function easeOutCubic(t: number): number {
  const clamped = clamp01(t);
  const eased = 1 - (1 - clamped) ** 3;
  return eased * 0.8 + clamped * 0.2;
}

interface NoiseParams {
  freq1: number;
  freq2: number;
  phase1: number;
  phase2: number;
  amplitude: number;
}

/** Deterministic per-racer wobble parameters, derived once from the seed + rank. */
function racerNoiseParams(seed: number, rank: number): NoiseParams {
  const rng = mulberry32((seed + rank * 1_000_003) >>> 0);
  return {
    freq1: 0.0025 + rng() * 0.003,
    freq2: 0.005 + rng() * 0.004,
    phase1: rng() * Math.PI * 2,
    phase2: rng() * Math.PI * 2,
    amplitude: 0.03 + rng() * 0.05,
  };
}

/** Every racer's finish time is staggered across the back half of the race for suspense. */
function finishTimeForRank(rank: number, teamCount: number): number {
  if (teamCount <= 1) return RACE_DURATION_MS * 0.5;
  return RACE_DURATION_MS * (0.5 + 0.5 * (rank / (teamCount - 1)));
}

/**
 * Given the revealed seed, the final draft order (index 0 = 1st pick),
 * and elapsed time in ms, returns every racer's current track position.
 * Deterministic: same inputs always produce the same output, in Node or
 * any browser.
 */
export function computeRacePositions(
  seed: number,
  finalOrder: readonly string[],
  elapsedMs: number,
): RacePosition[] {
  const t = Math.max(0, elapsedMs);
  const teamCount = finalOrder.length;

  return finalOrder.map((teamId, rank) => {
    const finishTime = finishTimeForRank(rank, teamCount);
    const finished = t >= finishTime;

    if (finished) {
      return { teamId, progress: 1, finished: true, rank };
    }

    const params = racerNoiseParams(seed, rank);
    const decay = 1 - t / finishTime; // 1 at start, 0 right at the finish
    const wave =
      Math.sin(t * params.freq1 + params.phase1) * 0.6 +
      Math.sin(t * params.freq2 + params.phase2) * 0.4;
    const jitter = wave * params.amplitude * decay;
    const progress = clamp01(easeOutCubic(t / finishTime) + jitter);

    return { teamId, progress, finished: false, rank };
  });
}

export function isRaceComplete(elapsedMs: number): boolean {
  return elapsedMs >= RACE_DURATION_MS;
}
