"use client";

import { useState } from "react";

interface ScheduleFormProps {
  adminToken: string;
  scheduledAt: string | null;
  onSaved: () => void;
}

function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ScheduleForm({ adminToken, scheduledAt, onSaved }: ScheduleFormProps) {
  const [value, setValue] = useState(() => toLocalInputValue(scheduledAt));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/admin/${adminToken}/schedule`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledAt: value ? new Date(value).toISOString() : null }),
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
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-full border border-turf-600 px-4 py-2 text-sm font-medium text-chalk hover:bg-turf-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      {error && <p className="text-sm text-endzone-400">{error}</p>}
    </div>
  );
}
