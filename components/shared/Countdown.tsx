"use client";

import { useEffect, useState } from "react";

interface CountdownProps {
  targetIso: string;
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

/** Live countdown to the coordination time set for the event. Doesn't auto-start anything — the commissioner still clicks "Start Race". */
export function Countdown({ targetIso }: CountdownProps) {
  // Stays null through the server-rendered pass and the first client render
  // (hydration), then fills in from an effect — a ticking clock can't be
  // computed identically on server and client, so we don't try.
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  useEffect(() => {
    function tick() {
      setRemainingMs(new Date(targetIso).getTime() - Date.now());
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetIso]);

  if (remainingMs === null) return null;

  if (remainingMs <= 0) {
    return (
      <div className="rounded-xl border border-gold-500/40 bg-gold-500/10 px-4 py-3 text-center font-display text-xl tracking-wide text-gold-500">
        🏈 Kickoff time — the race should start any moment now.
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-turf-700 bg-turf-800/50 px-4 py-4">
      <div className="text-xs uppercase tracking-wide text-chalk-faint">Race starts in</div>
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
    </div>
  );
}
