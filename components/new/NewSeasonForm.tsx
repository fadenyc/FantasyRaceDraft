"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SeasonWithTeamNames } from "@/lib/db/admin";

const DEFAULT_TEAM_COUNT = 12;

interface NewSeasonFormProps {
  previousSeasons: SeasonWithTeamNames[];
}

export function NewSeasonForm({ previousSeasons }: NewSeasonFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [teamNames, setTeamNames] = useState<string[]>(Array(DEFAULT_TEAM_COUNT).fill(""));
  const [scheduledAt, setScheduledAt] = useState("");
  const [reuseSeasonId, setReuseSeasonId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function updateTeamName(index: number, value: string) {
    setTeamNames((prev) => prev.map((n, i) => (i === index ? value : n)));
  }

  function addTeam() {
    setTeamNames((prev) => [...prev, ""]);
  }

  function removeTeam(index: number) {
    setTeamNames((prev) => prev.filter((_, i) => i !== index));
  }

  function applyReuse(seasonId: string) {
    setReuseSeasonId(seasonId);
    const season = previousSeasons.find((s) => s.id === seasonId);
    if (season && season.teamNames.length > 0) {
      setTeamNames(season.teamNames);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await fetch("/api/seasons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        teamNames,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to create season.");
      setSubmitting(false);
      return;
    }

    const { seasonId } = await res.json();
    router.push(`/dashboard/${seasonId}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <label htmlFor="season-name" className="font-display text-lg tracking-wide text-chalk">
          Season name
        </label>
        <input
          id="season-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="2026 League Draft Order"
          required
          className="rounded-lg border border-turf-600 bg-turf-900 px-3 py-2 text-chalk placeholder:text-chalk-faint"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="scheduled-at" className="font-display text-lg tracking-wide text-chalk">
          Event date/time (optional — just for coordination)
        </label>
        <input
          id="scheduled-at"
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          style={{ colorScheme: "dark" }}
          className="rounded-lg border border-turf-600 bg-turf-900 px-3 py-2 text-chalk"
        />
      </div>

      {previousSeasons.length > 0 && (
        <div className="flex flex-col gap-1">
          <label htmlFor="reuse-season" className="font-display text-lg tracking-wide text-chalk">
            Reuse teams from a previous season (optional)
          </label>
          <select
            id="reuse-season"
            value={reuseSeasonId}
            onChange={(e) => applyReuse(e.target.value)}
            className="rounded-lg border border-turf-600 bg-turf-900 px-3 py-2 text-chalk"
          >
            <option value="">Start fresh</option>
            {previousSeasons.map((season) => (
              <option key={season.id} value={season.id} disabled={season.teamNames.length === 0}>
                {season.name}
                {season.teamNames.length === 0 ? " (no teams)" : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="font-display text-lg tracking-wide text-chalk">Team names</span>
          <button
            type="button"
            onClick={addTeam}
            className="text-xs font-medium text-endzone-400 hover:underline"
          >
            + Add team
          </button>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {teamNames.map((value, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                value={value}
                onChange={(e) => updateTeamName(index, e.target.value)}
                placeholder={`Team ${index + 1}`}
                className="flex-1 rounded-lg border border-turf-600 bg-turf-900 px-3 py-2 text-sm text-chalk placeholder:text-chalk-faint"
              />
              {teamNames.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeTeam(index)}
                  aria-label={`Remove team ${index + 1}`}
                  className="flex h-11 w-11 shrink-0 items-center justify-center text-chalk-faint hover:text-chalk"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-endzone-400">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-full bg-endzone-500 px-4 py-3 font-display text-lg tracking-wide text-chalk shadow-[0_0_30px_-8px_var(--color-endzone-500)] hover:bg-endzone-600 disabled:opacity-50"
      >
        {submitting ? "Creating…" : "Create Season 🏈"}
      </button>
    </form>
  );
}
