import { describe, expect, it } from "vitest";
import { computeLiveStandings, computeRacePositions, RACE_DURATION_MS } from "./animation";
import { buildRaceProfileSet } from "./profile";

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

  it("never returns a predetermined rank field — only progress/velocity/finished", () => {
    const positions = computeRacePositions(42, finalOrder, 30_000);
    for (const p of positions) {
      expect(p).not.toHaveProperty("rank");
      expect(Object.keys(p).sort()).toEqual(["finished", "progress", "teamId", "velocity"]);
    }
  });

  it("1st-pick team finishes no later than the last-pick team (order honored end to end)", () => {
    const { runners } = buildRaceProfileSet(42, finalOrder);
    const firstPickTeam = runners[0].teamId;
    const lastPickTeam = runners[runners.length - 1].teamId;

    const midRace = computeRacePositions(42, finalOrder, RACE_DURATION_MS * 0.95);
    const firstPick = midRace.find((p) => p.teamId === firstPickTeam)!;
    const lastPick = midRace.find((p) => p.teamId === lastPickTeam)!;
    expect(firstPick.finished).toBe(true);
    expect(lastPick.finished).toBe(false);
  });

  it("a racer's progress keeps advancing noticeably right up until it finishes (never looks frozen)", () => {
    // Regression test: a pure ease-out curve's tail is nearly flat, and the
    // last-place racer's own finish coincides with the whole race's climax —
    // a flat tail there reads as "stuck," not "almost done."
    const { runners } = buildRaceProfileSet(42, finalOrder);
    const last = runners[runners.length - 1];

    const earlier = last.sample(last.startDelayMs + (last.finishTimeMs - last.startDelayMs) * 0.9);
    const later = last.sample(last.finishTimeMs - 50);

    expect(later.position - earlier.position).toBeGreaterThan(0.01);
  });
});

describe("computeLiveStandings", () => {
  it("matches the predetermined order once every runner has finished", () => {
    const { runners } = buildRaceProfileSet(42, finalOrder);
    const positions = computeRacePositions(42, finalOrder, RACE_DURATION_MS);
    const standings = computeLiveStandings(positions);
    expect(standings).toEqual(runners.map((r) => r.teamId));
  });

  it("does not just mirror the predetermined order mid-race — the pack is genuinely mixed up before it matters", () => {
    const { runners } = buildRaceProfileSet(42, finalOrder);
    const predeterminedOrder = runners.map((r) => r.teamId);

    // Sample a handful of early/mid timestamps and confirm live standings
    // diverge from the predetermined order at least once — proof the reveal
    // isn't just a straight line from t=0, it's an emergent result of the
    // curves. (If this ever starts failing, the "believable race" pacing
    // has regressed into something that trivially telegraphs the result.)
    const sampleTimes = [5_000, 15_000, 25_000, 35_000, 45_000];
    const anyDivergence = sampleTimes.some((t) => {
      const standings = computeLiveStandings(computeRacePositions(42, finalOrder, t));
      return standings.join(",") !== predeterminedOrder.join(",");
    });

    expect(anyDivergence).toBe(true);
  });

  it("a runner that has already finished never gets outranked by one still running", () => {
    const positions = computeRacePositions(42, finalOrder, RACE_DURATION_MS * 0.85);
    const standings = computeLiveStandings(positions);
    const positionByTeam = new Map(positions.map((p) => [p.teamId, p]));

    let sawUnfinished = false;
    for (const teamId of standings) {
      const p = positionByTeam.get(teamId)!;
      if (!p.finished) {
        sawUnfinished = true;
      } else if (sawUnfinished) {
        // A finished runner (progress === 1) appearing after an unfinished
        // one in the sort would mean the standings briefly rank someone
        // "behind" a runner still short of the line — sorting by progress
        // descending should never allow that.
        throw new Error(`Finished team ${teamId} was sorted behind an unfinished team`);
      }
    }
  });
});
