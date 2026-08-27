"use client";

import type { CSSProperties } from "react";
import { computeRacePositions } from "@/lib/race/animation";

export interface RaceCanvasTeam {
  id: string;
  name: string;
}

const ORDINALS = [
  "1st",
  "2nd",
  "3rd",
  "4th",
  "5th",
  "6th",
  "7th",
  "8th",
  "9th",
  "10th",
  "11th",
  "12th",
  "13th",
  "14th",
  "15th",
  "16th",
  "17th",
  "18th",
  "19th",
  "20th",
  "21st",
  "22nd",
  "23rd",
  "24th",
];

function ordinal(rank: number): string {
  return ORDINALS[rank] ?? `${rank + 1}th`;
}

export interface RaceCanvasProps {
  teams: RaceCanvasTeam[];
  finalOrder: string[];
  seed: number;
  elapsedMs: number;
  cheerPulses: Record<string, number>;
}

// Repeating yard-line stripes, stopping before the end zone.
const YARD_LINES_STYLE: CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(90deg, transparent, transparent calc(10% - 1px), color-mix(in srgb, var(--color-chalk) 18%, transparent) calc(10% - 1px), color-mix(in srgb, var(--color-chalk) 18%, transparent) 10%)",
  backgroundSize: "90% 100%",
  backgroundRepeat: "no-repeat",
};

export function RaceCanvas({ teams, finalOrder, seed, elapsedMs, cheerPulses }: RaceCanvasProps) {
  const positions = computeRacePositions(seed, finalOrder, elapsedMs);
  const positionByTeam = new Map(positions.map((p) => [p.teamId, p]));

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-turf-700 bg-turf-800/70 p-2 sm:gap-2 sm:p-4">
      {teams.map((team) => {
        const pos = positionByTeam.get(team.id);
        const pulseKey = cheerPulses[team.id];
        return (
          <div key={team.id} className="flex items-center gap-1.5 sm:gap-3">
            <div className="w-16 shrink-0 truncate text-xs font-medium text-chalk sm:w-40 sm:text-sm">
              {team.name}
            </div>
            <div
              className="relative h-8 min-w-0 flex-1 overflow-hidden rounded-md bg-turf-700 sm:h-9"
              style={YARD_LINES_STYLE}
            >
              <div className="absolute inset-y-0 right-0 flex w-[10%] items-center justify-center bg-gradient-to-l from-endzone-600 to-endzone-600/60 text-xs">
                🏁
              </div>
              <div
                key={pulseKey}
                className="absolute top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center text-base transition-[left] duration-100 ease-linear will-change-[left] sm:h-7 sm:w-7 sm:text-lg"
                style={{ left: `calc(${(pos?.progress ?? 0) * 90}% - ${(pos?.progress ?? 0) * 24}px)` }}
              >
                🏈
                {pulseKey !== undefined && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold-500/60" />
                )}
              </div>
            </div>
            <div className="w-10 shrink-0 text-right text-xs font-bold tabular-nums text-gold-500 sm:w-14 sm:text-sm">
              {pos?.finished ? ordinal(pos.rank) : ""}
            </div>
          </div>
        );
      })}
    </div>
  );
}
