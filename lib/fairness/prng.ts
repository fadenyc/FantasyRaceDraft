/**
 * Pure, dependency-free deterministic PRNG. Must run byte-identical in
 * Node (server, computing the canonical result) and every browser
 * (client-side animation + audit/replay) — no floating-point-sensitive
 * ops, only 32-bit integer math via Math.imul.
 */

/** mulberry32: given a 32-bit seed, returns a function producing floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Derives a 32-bit unsigned integer seed from a hex-encoded server seed
 * (or any hex string) by taking the first 4 bytes of its SHA-256 hash.
 * Kept separate from hashing so this module has zero crypto dependency
 * and works identically in the browser (subtle crypto) and Node.
 */
export function bytesToUint32(bytes: Uint8Array): number {
  return (
    ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0
  );
}
