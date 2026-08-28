"use client";

import { useEffect, useState } from "react";
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

  // toLocaleString() formats by the runtime's timezone/locale, which differs
  // between the server (wherever it's deployed) and a visitor's browser —
  // rendering it directly causes a real hydration mismatch for anyone
  // outside the server's timezone. Stays blank through SSR and the first
  // client render, then fills in from an effect once it's safe to format
  // using the browser's own locale.
  const [publishedLabel, setPublishedLabel] = useState("");
  useEffect(() => {
    if (!commitmentPublishedAt) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPublishedLabel(` (${new Date(commitmentPublishedAt).toLocaleString()})`);
  }, [commitmentPublishedAt]);

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
            Before the race, the app generates a secret random code by itself — nobody picks it,
            not even the commissioner — and locks it in a digital safe. That&apos;s the
            &quot;fingerprint&quot; below. Nobody can change what&apos;s inside the safe after
            it&apos;s locked, and you can&apos;t peek inside to guess the secret code either.
          </li>
          <li>
            The team names get locked in at the exact same moment. So the commissioner has to
            decide the rules before knowing how they&apos;ll turn out — no changing team names
            after seeing which order they&apos;d land in.
          </li>
          <li>
            When it&apos;s go time, the safe opens and the secret code comes out. That code gets
            run through a simple math formula (the same one every time, and it&apos;s public) to
            decide the draft order. Anyone can grab the same code and run the same formula
            themselves to check they get the exact same result.
          </li>
        </ol>

        {commitmentHash && (
          <div>
            <div className="text-xs uppercase tracking-wide text-chalk-faint">
              Published fingerprint{publishedLabel}
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
          <p className="text-xs text-chalk-faint">The secret code stays hidden until the race starts.</p>
        )}
      </div>
    </details>
  );
}
