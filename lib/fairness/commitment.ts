import { bytesToUint32 } from "./prng";
import { randomHex, sha256Bytes, sha256Hex } from "./hash";

/** 32 random bytes, hex-encoded. Kept secret from commit until reveal. */
export function generateServerSeed(): string {
  return randomHex(32);
}

/** Published immediately at commit time; proves the seed can't be swapped later. */
export async function computeCommitmentHash(serverSeed: string): Promise<string> {
  return sha256Hex(serverSeed);
}

/** Derives the 32-bit integer seed fed to the shuffle from the revealed server seed. */
export async function deriveRevealSeedUint32(serverSeed: string): Promise<number> {
  const digest = await sha256Bytes(serverSeed);
  return bytesToUint32(digest.slice(0, 4));
}
