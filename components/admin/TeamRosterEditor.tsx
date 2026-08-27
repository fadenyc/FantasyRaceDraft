"use client";

import { useState } from "react";
import type { Team } from "@/lib/db/types";

interface TeamRosterEditorProps {
  adminToken: string;
  teams: Team[];
  onSaved: () => void;
}

export function TeamRosterEditor({ adminToken, teams, onSaved }: TeamRosterEditorProps) {
  const [names, setNames] = useState(() => Object.fromEntries(teams.map((t) => [t.id, t.name])));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/admin/${adminToken}/teams`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teams: teams.map((t) => ({ id: t.id, name: names[t.id] })) }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to save team names.");
      setSaving(false);
      return;
    }
    setSaving(false);
    onSaved();
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="font-display text-lg tracking-wide text-chalk">Team names</span>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {teams.map((team) => (
          <input
            key={team.id}
            value={names[team.id] ?? ""}
            onChange={(e) => setNames((prev) => ({ ...prev, [team.id]: e.target.value }))}
            className="rounded-lg border border-turf-600 bg-turf-900 px-3 py-2 text-sm text-chalk"
          />
        ))}
      </div>
      {error && <p className="text-sm text-endzone-400">{error}</p>}
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="w-fit rounded-full border border-turf-600 px-4 py-2 text-sm font-medium text-chalk hover:bg-turf-700 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save team names"}
      </button>
    </div>
  );
}
