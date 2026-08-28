"use client";

import { useState } from "react";

interface CommitPanelProps {
  /** Base admin API path — `/api/admin/{adminToken}` (legacy) or `/api/dashboard/{seasonId}` (owned). */
  apiBase: string;
  onCommitted: () => void;
}

export function CommitPanel({ apiBase, onCommitted }: CommitPanelProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function commit() {
    setSubmitting(true);
    setError(null);
    const res = await fetch(`${apiBase}/commit`, { method: "POST" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to commit.");
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    onCommitted();
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-endzone-500/40 bg-endzone-500/10 p-4">
      <div className="font-display text-lg tracking-wide text-chalk">Lock roster &amp; commit</div>
      <p className="text-sm text-chalk-muted">
        This generates the secret fairness seed and publishes its fingerprint. Team names can&apos;t
        be edited after this — make sure the roster is final.
      </p>
      {error && <p className="text-sm text-endzone-400">{error}</p>}
      {confirming ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={commit}
            disabled={submitting}
            className="rounded-full bg-endzone-500 px-4 py-2 text-sm font-semibold text-chalk hover:bg-endzone-600 disabled:opacity-50"
          >
            {submitting ? "Committing…" : "Yes, lock it in"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="rounded-full border border-turf-600 px-4 py-2 text-sm text-chalk hover:bg-turf-700"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="w-fit rounded-full bg-endzone-500 px-4 py-2 text-sm font-semibold text-chalk hover:bg-endzone-600"
        >
          Lock Roster &amp; Commit
        </button>
      )}
    </div>
  );
}
