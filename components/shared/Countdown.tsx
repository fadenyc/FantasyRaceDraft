"use client";

import { useEffect, useState } from "react";
import { GRACE_PERIOD_MINUTES } from "@/lib/constants";

interface CountdownProps {
  targetIso: string;
  /** Whether the roster is locked — the grace-period phase only makes sense once there's something to start. */
  committed: boolean;
}

interface Segment {
  label: string;
  value: number;
}

function segmentsFor(remainingMs: number): Segment[] {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const segments: Segment[] = [];
  if (days > 0) segments.push({ label: "Days", value: days });
  if (days > 0 || hours > 0) segments.push({ label: "Hrs", value: hours });
  segments.push({ label: "Min", value: minutes });
  segments.push({ label: "Sec", value: seconds });
  return segments;
}

function ScoreboardSegments({ remainingMs }: { remainingMs: number }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {segmentsFor(remainingMs).map((segment) => (
        <div
          key={segment.label}
          className="flex min-w-[56px] flex-col items-center rounded-lg border border-turf-600 bg-turf-900 px-3 py-2"
        >
          <span className="font-display text-3xl tabular-nums text-gold-500">
            {String(segment.value).padStart(2, "0")}
          </span>
          <span className="text-[10px] uppercase tracking-wide text-chalk-faint">{segment.label}</span>
        </div>
      ))}
    </div>
  );
}

function MessageBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gold-500/40 bg-gold-500/10 px-4 py-3 text-center font-display text-xl tracking-wide text-gold-500">
      {children}
    </div>
  );
}

/**
 * Live countdown to the scheduled time, then a grace period for stragglers.
 * Purely a display — the actual auto-start trigger lives in the admin
 * dashboard (it needs the admin token), this just shows where things stand.
 */
export function Countdown({ targetIso, committed }: CountdownProps) {
  // Stays null through the server-rendered pass and the first client render
  // (hydration), then fills in from an effect — a ticking clock can't be
  // computed identically on server and client, so we don't try.
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNowMs(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  if (nowMs === null) return null;

  const scheduledMs = new Date(targetIso).getTime();
  const graceEndMs = scheduledMs + GRACE_PERIOD_MINUTES * 60_000;

  if (nowMs < scheduledMs) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-turf-700 bg-turf-800/50 px-4 py-4">
        <div className="text-xs uppercase tracking-wide text-chalk-faint">Race starts in</div>
        <ScoreboardSegments remainingMs={scheduledMs - nowMs} />
      </div>
    );
  }

  if (!committed) {
    return <MessageBox>⏳ Waiting for the commissioner to lock the roster…</MessageBox>;
  }

  if (nowMs < graceEndMs) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-turf-700 bg-turf-800/50 px-4 py-4">
        <div className="text-xs uppercase tracking-wide text-chalk-faint">
          🏈 Room&apos;s open — race auto-starts in
        </div>
        <ScoreboardSegments remainingMs={graceEndMs - nowMs} />
        <div className="text-[10px] text-chalk-faint">Stragglers can still pick their team until then</div>
      </div>
    );
  }

  return <MessageBox>🏈 Kickoff time — the race should start any moment now.</MessageBox>;
}
