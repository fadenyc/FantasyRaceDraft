"use client";

import { useEffect, useRef, useState } from "react";
import { RACE_DURATION_MS } from "@/lib/race/animation";

export type ClockMode =
  | { mode: "idle" }
  | { mode: "live"; raceStartAt: string }
  | { mode: "replay" };

/**
 * Drives the race animation's elapsed-time source. "live" derives elapsed
 * time from the shared server timestamp broadcast at reveal (so every
 * viewer converges without per-frame network traffic); "replay" just
 * auto-plays from t=0 on mount. Both feed the same pure
 * computeRacePositions function, so live and replay render identically.
 */
export function useElapsedClock(mode: ClockMode): { elapsedMs: number; complete: boolean } {
  const [elapsedMs, setElapsedMs] = useState(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    // "idle" leaves elapsedMs at its initial 0 and starts no animation loop.
    // The app never transitions a live/replay clock back to idle, so no reset is needed here.
    if (mode.mode === "idle") return;

    const origin = mode.mode === "live" ? new Date(mode.raceStartAt).getTime() : Date.now();

    const tick = () => {
      const next = Math.min(RACE_DURATION_MS, Date.now() - origin);
      setElapsedMs(next);
      if (next < RACE_DURATION_MS) {
        frameRef.current = requestAnimationFrame(tick);
      }
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode.mode, mode.mode === "live" ? mode.raceStartAt : null]);

  return { elapsedMs, complete: elapsedMs >= RACE_DURATION_MS };
}
