import { buildRaceProfileSet, DEFAULT_RACE_CONFIG, type RaceConfig, type RaceProfileSet } from "./profile";

export const RACE_DURATION_MS = DEFAULT_RACE_CONFIG.durationMs;

export interface RacePosition {
  teamId: string;
  /** 0..1 along the track. */
  progress: number;
  /** Position units per ms — drives lean/bob/streak/sprite-cadence effects, not display. */
  velocity: number;
  finished: boolean;
}

// Rebuilding a profile set is cheap (a few hundred float ops per runner),
// but there's no reason to redo it on every sample when the same
// seed+order gets queried repeatedly — a render loop calling this every
// frame, or a test looping over t. Small bounded cache, not a perf
// requirement so much as "don't do pointless work."
const profileCache = new Map<string, RaceProfileSet>();
const PROFILE_CACHE_LIMIT = 8;

function getProfileSet(
  seed: number,
  finalOrder: readonly string[],
  durationMs: number,
): RaceProfileSet {
  const key = `${seed}:${finalOrder.join(",")}:${durationMs}`;
  let set = profileCache.get(key);
  if (!set) {
    set = buildRaceProfileSet(seed, finalOrder, { ...DEFAULT_RACE_CONFIG, durationMs });
    profileCache.set(key, set);
    if (profileCache.size > PROFILE_CACHE_LIMIT) {
      const oldestKey = profileCache.keys().next().value;
      if (oldestKey !== undefined) profileCache.delete(oldestKey);
    }
  }
  return set;
}

/**
 * Given the revealed seed, the final draft order (index 0 = 1st pick), and
 * elapsed time in ms, returns every racer's current position. Deterministic:
 * same inputs always produce the same output, in Node or any browser — so
 * live viewers and a later replay render identically, and a client that
 * resyncs after being backgrounded just resamples at the new elapsed time
 * with no drift.
 *
 * Deliberately does NOT return each runner's predetermined finish rank —
 * only `progress` and `finished`. The order teams actually finish in is an
 * emergent property of the profile curves (see lib/race/profile.ts), not a
 * value read off `finalOrder` early. Callers derive standings by sorting
 * `progress` (see computeLiveStandings) so the UI can never leak the
 * predetermined order before a runner has actually crossed the line.
 */
export function computeRacePositions(
  seed: number,
  finalOrder: readonly string[],
  elapsedMs: number,
  durationMs: number = RACE_DURATION_MS,
): RacePosition[] {
  const { runners } = getProfileSet(seed, finalOrder, durationMs);
  const t = Math.max(0, elapsedMs);

  return runners.map((runner) => {
    const { position, velocity } = runner.sample(t);
    return {
      teamId: runner.teamId,
      progress: position,
      velocity,
      finished: t >= runner.finishTimeMs,
    };
  });
}

export function isRaceComplete(elapsedMs: number, durationMs: number = RACE_DURATION_MS): boolean {
  return elapsedMs >= durationMs;
}

/** Current standings a viewer would actually see, sorted by live position — never reads the predetermined order. */
export function computeLiveStandings(positions: readonly RacePosition[]): string[] {
  return positions
    .slice()
    .sort((a, b) => b.progress - a.progress)
    .map((p) => p.teamId);
}

export type { RaceConfig };
