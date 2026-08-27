import { describe, expect, it } from "vitest";
import { buildRaceProfileSet, DEFAULT_RACE_CONFIG } from "./profile";

const finalOrder = ["t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8", "t9", "t10", "t11", "t12"];

describe("buildRaceProfileSet", () => {
  it("is deterministic for a fixed seed and order", () => {
    const a = buildRaceProfileSet(42, finalOrder);
    const b = buildRaceProfileSet(42, finalOrder);
    expect(a.runners.map((r) => r.finishTimeMs)).toEqual(b.runners.map((r) => r.finishTimeMs));
    expect(a.runners.map((r) => r.startDelayMs)).toEqual(b.runners.map((r) => r.startDelayMs));

    for (const t of [1000, 15_000, 40_000, 59_000]) {
      expect(a.runners.map((r) => r.sample(t))).toEqual(b.runners.map((r) => r.sample(t)));
    }
  });

  it("assigns strictly increasing finish times matching finalOrder — the predetermined order is always honored", () => {
    const { runners } = buildRaceProfileSet(42, finalOrder);
    for (let i = 1; i < runners.length; i++) {
      expect(runners[i].finishTimeMs).toBeGreaterThan(runners[i - 1].finishTimeMs);
    }
  });

  it("keeps the whole pack in play through ~78% of the race — nobody finishes early", () => {
    const { runners, config } = buildRaceProfileSet(42, finalOrder);
    const earliestAllowed = config.durationMs * config.packFinishStartFraction - config.durationMs * 0.07; // small jitter tolerance
    for (const runner of runners) {
      expect(runner.finishTimeMs).toBeGreaterThan(earliestAllowed);
    }
  });

  it("every runner's curve starts at 0, ends at 1, and never exceeds [0,1]", () => {
    const { runners } = buildRaceProfileSet(7, finalOrder);
    for (const runner of runners) {
      expect(runner.sample(0).position).toBe(0);
      expect(runner.sample(runner.finishTimeMs).position).toBe(1);
      for (let t = 0; t <= runner.finishTimeMs; t += 500) {
        const { position } = runner.sample(t);
        expect(position).toBeGreaterThanOrEqual(0);
        expect(position).toBeLessThanOrEqual(1);
      }
    }
  });

  it("velocity is never negative — stalls slow a runner down, they never move backward", () => {
    const { runners } = buildRaceProfileSet(99, finalOrder);
    for (const runner of runners) {
      for (let t = runner.startDelayMs; t <= runner.finishTimeMs; t += 250) {
        expect(runner.sample(t).velocity).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("start delays fall within the configured 20-120ms range", () => {
    const { runners } = buildRaceProfileSet(123, finalOrder);
    for (const runner of runners) {
      expect(runner.startDelayMs).toBeGreaterThanOrEqual(DEFAULT_RACE_CONFIG.minStartDelayMs);
      expect(runner.startDelayMs).toBeLessThanOrEqual(DEFAULT_RACE_CONFIG.maxStartDelayMs);
    }
  });

  it("a different seed produces different pacing (not literally the same race every time)", () => {
    const a = buildRaceProfileSet(1, finalOrder);
    const b = buildRaceProfileSet(2, finalOrder);
    expect(a.runners.map((r) => r.finishTimeMs)).not.toEqual(b.runners.map((r) => r.finishTimeMs));
  });
});
