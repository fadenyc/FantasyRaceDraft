"use client";

import { useState } from "react";

interface ScheduleFormProps {
  /** Base admin API path — `/api/admin/{adminToken}` (legacy) or `/api/dashboard/{seasonId}` (owned). */
  apiBase: string;
  scheduledAt: string | null;
  raceDurationSeconds: number;
  snakeDraftRounds: number | null;
  onSaved: () => void;
}

const MIN_DURATION_SECONDS = 15;
const MAX_DURATION_SECONDS = 300;
const MIN_ROUNDS = 1;
const MAX_ROUNDS = 30;
const DEFAULT_ROUNDS = 15;

function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ScheduleForm({
  apiBase,
  scheduledAt,
  raceDurationSeconds,
  snakeDraftRounds,
  onSaved,
}: ScheduleFormProps) {
  const [value, setValue] = useState(() => toLocalInputValue(scheduledAt));
  const [duration, setDuration] = useState(String(raceDurationSeconds));
  const [snakeEnabled, setSnakeEnabled] = useState(snakeDraftRounds !== null);
  const [rounds, setRounds] = useState(String(snakeDraftRounds ?? DEFAULT_ROUNDS));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const durationSeconds = Number(duration);
    if (
      !Number.isFinite(durationSeconds) ||
      durationSeconds < MIN_DURATION_SECONDS ||
      durationSeconds > MAX_DURATION_SECONDS
    ) {
      setError(`Race length must be between ${MIN_DURATION_SECONDS} and ${MAX_DURATION_SECONDS} seconds.`);
      return;
    }

    const roundsNumber = Number(rounds);
    if (snakeEnabled && (!Number.isFinite(roundsNumber) || roundsNumber < MIN_ROUNDS || roundsNumber > MAX_ROUNDS)) {
      setError(`Snake board rounds must be between ${MIN_ROUNDS} and ${MAX_ROUNDS}.`);
      return;
    }

    setSaving(true);
    setError(null);
    const res = await fetch(`${apiBase}/schedule`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scheduledAt: value ? new Date(value).toISOString() : null,
        raceDurationSeconds: durationSeconds,
        snakeDraftRounds: snakeEnabled ? roundsNumber : null,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to save schedule.");
      setSaving(false);
      return;
    }
    setSaving(false);
    onSaved();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="schedule-input" className="font-display text-lg tracking-wide text-chalk">
          Event date/time
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            id="schedule-input"
            type="datetime-local"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            style={{ colorScheme: "dark" }}
            className="rounded-lg border border-turf-600 bg-turf-900 px-3 py-2 text-sm text-chalk"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="duration-input" className="font-display text-lg tracking-wide text-chalk">
          Race length
        </label>
        <p className="text-xs text-chalk-faint">
          How long the animated race takes to play out, from kickoff to the last team crossing the
          finish line. Doesn&apos;t affect the outcome — just how long everyone watches.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            id="duration-input"
            type="number"
            min={MIN_DURATION_SECONDS}
            max={MAX_DURATION_SECONDS}
            step={5}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="w-24 rounded-lg border border-turf-600 bg-turf-900 px-3 py-2 text-sm text-chalk"
          />
          <span className="text-sm text-chalk-muted">seconds</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 font-display text-lg tracking-wide text-chalk">
          <input
            type="checkbox"
            checked={snakeEnabled}
            onChange={(e) => setSnakeEnabled(e.target.checked)}
            className="h-4 w-4 accent-endzone-500"
          />
          Show full snake draft board
        </label>
        <p className="text-xs text-chalk-faint">
          After the race, also expand the round-1 order into a full snake board (round 2 reversed,
          round 3 forward, and so on) for however many rounds your draft runs.
        </p>
        {snakeEnabled && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="rounds-input"
              type="number"
              min={MIN_ROUNDS}
              max={MAX_ROUNDS}
              value={rounds}
              onChange={(e) => setRounds(e.target.value)}
              className="w-24 rounded-lg border border-turf-600 bg-turf-900 px-3 py-2 text-sm text-chalk"
            />
            <span className="text-sm text-chalk-muted">rounds</span>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="w-fit rounded-full border border-turf-600 px-4 py-2 text-sm font-medium text-chalk hover:bg-turf-700 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save"}
      </button>
      {error && <p className="text-sm text-endzone-400">{error}</p>}
    </div>
  );
}
