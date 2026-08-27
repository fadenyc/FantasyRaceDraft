import { describe, expect, it } from "vitest";
import { computeRacePositions, RACE_DURATION_MS } from "./animation";

const finalOrder = ["t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8", "t9", "t10", "t11", "t12"];

describe("computeRacePositions", () => {
  it("is a pure function: identical inputs always produce identical output", () => {
    const a = computeRacePositions(42, finalOrder, 8000);
    const b = computeRacePositions(42, finalOrder, 8000);
    expect(b).toEqual(a);
  });

  it("every racer has finished (progress 1) by the end of the race duration", () => {
    const positions = computeRacePositions(42, finalOrder, RACE_DURATION_MS);
    for (const p of positions) {
      expect(p.progress).toBe(1);
      expect(p.finished).toBe(true);
    }
  });

  it("no racer has finished at t=0", () => {
    const positions = computeRacePositions(42, finalOrder, 0);
    for (const p of positions) {
      expect(p.finished).toBe(false);
    }
  });

  it("progress values always stay within [0, 1]", () => {
    for (let t = 0; t <= RACE_DURATION_MS; t += 500) {
      const positions = computeRacePositions(42, finalOrder, t);
      for (const p of positions) {
        expect(p.progress).toBeGreaterThanOrEqual(0);
        expect(p.progress).toBeLessThanOrEqual(1);
      }
    }
  });

  it("1st-pick rank finishes no later than last-pick rank", () => {
    // rank 0 (1st pick) is scheduled to finish earlier than rank 11 (last pick)
    const midRace = computeRacePositions(42, finalOrder, RACE_DURATION_MS * 0.75);
    const firstPick = midRace.find((p) => p.rank === 0)!;
    const lastPick = midRace.find((p) => p.rank === finalOrder.length - 1)!;
    expect(firstPick.finished).toBe(true);
    expect(lastPick.finished).toBe(false);
  });

  it("a racer's progress keeps advancing noticeably right up until it finishes (never looks frozen)", () => {
    // Regression test: a pure ease-out curve's tail is nearly flat, and since
    // the last-place racer's own finish time lines up with the very end of
    // the whole race, a flat tail there reads as "stuck" during the race's
    // climax. Sample the last-place racer's own final 10% of its timeline
    // and confirm it's still visibly moving, not just crawling.
    const lastRank = finalOrder.length - 1;
    const finishTime = RACE_DURATION_MS; // last-place racer's finish time == full race duration
    const tenPercentBeforeFinish = finishTime * 0.9;

    const earlier = computeRacePositions(42, finalOrder, tenPercentBeforeFinish).find(
      (p) => p.rank === lastRank,
    )!;
    const later = computeRacePositions(42, finalOrder, finishTime - 50).find(
      (p) => p.rank === lastRank,
    )!;

    // Over that last stretch, progress should still move by a meaningful
    // amount — not the near-zero delta a pure cubic ease-out tail would give.
    expect(later.progress - earlier.progress).toBeGreaterThan(0.02);
  });
});
