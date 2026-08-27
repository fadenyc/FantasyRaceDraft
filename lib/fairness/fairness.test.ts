import { describe, expect, it } from "vitest";
import { computeCommitmentHash, deriveRevealSeedUint32, generateServerSeed } from "./commitment";
import { sha256Hex } from "./hash";
import { computeFinalOrder, seededShuffle } from "./shuffle";

describe("seededShuffle", () => {
  it("is deterministic for a fixed seed and input", () => {
    const items = ["a", "b", "c", "d", "e"];
    const first = seededShuffle(items, 12345);
    const second = seededShuffle(items, 12345);
    expect(second).toEqual(first);
  });

  it("produces a different order for a different seed (sanity check, not guaranteed but true for this fixture)", () => {
    const items = ["a", "b", "c", "d", "e"];
    const a = seededShuffle(items, 1);
    const b = seededShuffle(items, 2);
    expect(a).not.toEqual(b);
  });

  it("never mutates the input array", () => {
    const items = ["a", "b", "c"];
    const copy = [...items];
    seededShuffle(items, 42);
    expect(items).toEqual(copy);
  });
});

describe("computeFinalOrder", () => {
  const teams = [
    { id: "t1", sort_index: 0 },
    { id: "t2", sort_index: 1 },
    { id: "t3", sort_index: 2 },
    { id: "t4", sort_index: 3 },
    { id: "t5", sort_index: 4 },
    { id: "t6", sort_index: 5 },
    { id: "t7", sort_index: 6 },
    { id: "t8", sort_index: 7 },
    { id: "t9", sort_index: 8 },
    { id: "t10", sort_index: 9 },
    { id: "t11", sort_index: 10 },
    { id: "t12", sort_index: 11 },
  ];

  it("is a full permutation with no duplicates and no missing teams", () => {
    const order = computeFinalOrder(teams, 987654321);
    expect(order).toHaveLength(12);
    expect(new Set(order).size).toBe(12);
    for (const team of teams) {
      expect(order).toContain(team.id);
    }
  });

  it("is independent of the order teams are passed in (sorted by sort_index first)", () => {
    const shuffledInput = [...teams].reverse();
    const a = computeFinalOrder(teams, 555);
    const b = computeFinalOrder(shuffledInput, 555);
    expect(b).toEqual(a);
  });

  it("is deterministic and reproducible from the same seed", () => {
    const a = computeFinalOrder(teams, 42);
    const b = computeFinalOrder(teams, 42);
    expect(b).toEqual(a);
  });
});

describe("commit-reveal", () => {
  it("commitment hash matches an independently computed sha256(server_seed)", async () => {
    const serverSeed = generateServerSeed();
    const commitmentHash = await computeCommitmentHash(serverSeed);
    const independentlyComputed = await sha256Hex(serverSeed);
    expect(commitmentHash).toBe(independentlyComputed);
  });

  it("generates a 64-char hex server seed (32 bytes)", () => {
    const serverSeed = generateServerSeed();
    expect(serverSeed).toMatch(/^[0-9a-f]{64}$/);
  });

  it("derives a stable, deterministic uint32 seed from a given server seed", async () => {
    const serverSeed = "a".repeat(64);
    const first = await deriveRevealSeedUint32(serverSeed);
    const second = await deriveRevealSeedUint32(serverSeed);
    expect(second).toBe(first);
    expect(Number.isInteger(first)).toBe(true);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThanOrEqual(0xffffffff);
  });
});
