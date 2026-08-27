"use client";

import { useState } from "react";
import { sha256Hex } from "@/lib/fairness/hash";

interface FairnessExplainerProps {
  commitmentHash: string | null;
  commitmentPublishedAt: string | null;
  serverSeed: string | null;
  revealSeedUint32: number | null;
}

export function FairnessExplainer({
  commitmentHash,
  commitmentPublishedAt,
  serverSeed,
  revealSeedUint32,
}: FairnessExplainerProps) {
  const [verifyResult, setVerifyResult] = useState<"idle" | "checking" | "match" | "mismatch">(
    "idle",
  );

  async function verify() {
    if (!serverSeed || !commitmentHash) return;
    setVerifyResult("checking");
    const computed = await sha256Hex(serverSeed);
    setVerifyResult(computed === commitmentHash ? "match" : "mismatch");
  }

  return (
    <details className="rounded-xl border border-turf-700 bg-turf-800/50 p-4 text-sm">
      <summary className="cursor-pointer font-display text-lg tracking-wide text-chalk">
        How do I know this isn&apos;t rigged?
      </summary>
      <div className="mt-3 flex flex-col gap-3 text-chalk-muted">
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            Before the race, the commissioner generates a secret random value and publishes only
            its SHA-256 hash — that&apos;s the fingerprint below. A hash can&apos;t be reversed, so
            nobody can figure out the secret from it, but once it&apos;s revealed you can check the
            hash matches.
          </li>
          <li>
            Team names are locked the moment that fingerprint is published — the thing being
            shuffled can&apos;t change after committing to how it&apos;ll be shuffled.
          </li>
          <li>
            At race time, the secret value is revealed and fed into a simple, public, deterministic
            shuffle function. Anyone can re-run it and get the exact same result.
          </li>
        </ol>

        {commitmentHash && (
          <div>
            <div className="text-xs uppercase tracking-wide text-chalk-faint">
              Published fingerprint{commitmentPublishedAt ? ` (${new Date(commitmentPublishedAt).toLocaleString()})` : ""}
            </div>
            <code className="mt-1 block break-all rounded bg-turf-900 p-2 text-xs text-field-400">
              {commitmentHash}
            </code>
          </div>
        )}

        {serverSeed ? (
          <div>
            <div className="text-xs uppercase tracking-wide text-chalk-faint">
              Revealed secret value
            </div>
            <code className="mt-1 block break-all rounded bg-turf-900 p-2 text-xs text-field-400">
              {serverSeed}
            </code>
            {revealSeedUint32 !== null && (
              <div className="mt-1 text-xs text-chalk-faint">
                Derived numeric seed used by the shuffle: {revealSeedUint32}
              </div>
            )}
            <button
              type="button"
              onClick={verify}
              className="mt-2 rounded-full border border-chalk/20 px-3 py-2 text-xs font-medium text-chalk hover:bg-chalk/10"
            >
              Verify it yourself
            </button>
            {verifyResult === "checking" && (
              <span className="ml-2 text-xs text-chalk-faint">Checking…</span>
            )}
            {verifyResult === "match" && (
              <span className="ml-2 text-xs font-medium text-field-400">
                ✓ Matches the fingerprint published before the race.
              </span>
            )}
            {verifyResult === "mismatch" && (
              <span className="ml-2 text-xs font-medium text-endzone-400">
                ✗ Does not match — something is wrong.
              </span>
            )}
          </div>
        ) : (
          <p className="text-xs text-chalk-faint">The secret value stays hidden until the race starts.</p>
        )}
      </div>
    </details>
  );
}
