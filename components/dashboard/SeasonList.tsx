"use client";

import { useState } from "react";
import Link from "next/link";
import type { Season } from "@/lib/db/types";

interface SeasonListProps {
  initialSeasons: Season[];
}

export function SeasonList({ initialSeasons }: SeasonListProps) {
  const [seasons, setSeasons] = useState(initialSeasons);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete(seasonId: string) {
    setDeletingId(seasonId);
    setError(null);
    const res = await fetch(`/api/dashboard/${seasonId}`, { method: "DELETE" });
    if (res.ok) {
      setSeasons((prev) => prev.filter((s) => s.id !== seasonId));
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to delete season.");
    }
    setDeletingId(null);
    setConfirmingId(null);
  }

  if (seasons.length === 0) {
    return (
      <p className="text-base text-chalk-muted">
        No seasons yet — create one to get a link you can share with your league.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-sm text-endzone-400">{error}</p>}
      <ul className="flex flex-col gap-2">
        {seasons.map((season) => {
          const year = new Date(season.created_at).getFullYear();
          const isConfirming = confirmingId === season.id;

          return (
            <li
              key={season.id}
              className="flex items-center gap-2 rounded-lg border border-turf-700 bg-turf-800/50 px-4 py-3"
            >
              {isConfirming ? (
                <div className="flex w-full flex-wrap items-center justify-between gap-2">
                  <span className="text-sm text-chalk">
                    Delete &quot;{season.name}&quot;? This can&apos;t be undone.
                  </span>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => confirmDelete(season.id)}
                      disabled={deletingId === season.id}
                      className="rounded-full bg-endzone-500 px-3 py-1.5 text-xs font-medium text-chalk hover:bg-endzone-600 disabled:opacity-50"
                    >
                      {deletingId === season.id ? "Deleting…" : "Yes, delete"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingId(null)}
                      disabled={deletingId === season.id}
                      className="rounded-full border border-turf-600 px-3 py-1.5 text-xs text-chalk hover:bg-turf-700 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <Link
                    href={`/dashboard/${season.id}`}
                    className="flex min-w-0 flex-1 items-baseline gap-2 text-chalk hover:text-chalk"
                  >
                    <span className="truncate text-lg font-medium">{season.name}</span>
                    <span className="shrink-0 text-xs text-chalk-faint">{year}</span>
                  </Link>
                  <span className="shrink-0 text-sm uppercase tracking-wide text-chalk-faint">
                    {season.status}
                  </span>
                  <button
                    type="button"
                    onClick={() => setConfirmingId(season.id)}
                    aria-label={`Delete ${season.name}`}
                    className="shrink-0 rounded-full p-1.5 text-chalk-faint hover:bg-turf-700 hover:text-endzone-400"
                  >
                    🗑️
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
