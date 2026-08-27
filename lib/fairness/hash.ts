/**
 * Isomorphic SHA-256 helpers built on the Web Crypto API, which is
 * available both in Node (globalThis.crypto since Node 19+) and every
 * browser. Keeping this on Web Crypto instead of `node:crypto` is what
 * lets the exact same fairness code run server-side (to compute the
 * canonical result) and client-side (for the public "verify it
 * yourself" box) with zero divergence.
 */

function toHex(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Bytes(input: string): Promise<Uint8Array> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(digest);
}

export async function sha256Hex(input: string): Promise<string> {
  return toHex(await sha256Bytes(input));
}

/** Generates `byteLength` cryptographically random bytes, hex-encoded. */
export function randomHex(byteLength: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return toHex(bytes);
}
