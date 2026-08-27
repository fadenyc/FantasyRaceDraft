import { mulberry32 } from "./prng";

/**
 * Deterministic Fisher–Yates shuffle driven by a seeded PRNG. Given the
 * same seed and the same input order, always produces the same
 * permutation — this is what makes the result auditable and replayable.
 *
 * `items` must already be in a stable, canonical order (e.g. sorted by
 * `sort_index`), never raw DB query order, or the shuffle input itself
 * becomes non-deterministic.
 */
export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const result = items.slice();
  const random = mulberry32(seed);

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

export interface ShuffleTeam {
  id: string;
  sort_index: number;
}

/**
 * Produces the final draft order (index 0 = 1st pick) for a season's
 * teams from its reveal seed. Teams are sorted by `sort_index` first so
 * the shuffle input is always canonical regardless of query order.
 */
export function computeFinalOrder(
  teams: readonly ShuffleTeam[],
  seed: number,
): string[] {
  const canonical = teams
    .slice()
    .sort((a, b) => a.sort_index - b.sort_index)
    .map((t) => t.id);

  return seededShuffle(canonical, seed);
}
