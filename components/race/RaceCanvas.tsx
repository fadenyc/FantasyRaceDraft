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

// One character sprite per lane, assigned by lane position (not by finish
// rank) so each team keeps the same runner for the whole race. Cycles if
// there are ever more lanes than sprites.
const PLAYER_SPRITES = [
  "/images/players/01-alpha.png",
  "/images/players/02-bravo.png",
  "/images/players/03-charlie.png",
  "/images/players/04-delta.png",
  "/images/players/05-echo.png",
  "/images/players/06-foxtrot.png",
  "/images/players/07-golf.png",
  "/images/players/08-hotel.png",
  "/images/players/09-india.png",
  "/images/players/10-juliett.png",
  "/images/players/11-kilo.png",
  "/images/players/12-lima.png",
];

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
      {teams.map((team, index) => {
        const pos = positionByTeam.get(team.id);
        const pulseKey = cheerPulses[team.id];
        const sprite = PLAYER_SPRITES[index % PLAYER_SPRITES.length];
        return (
          <div key={team.id} className="flex items-center gap-1.5 sm:gap-3">
            <div className="w-16 shrink-0 truncate text-xs font-medium text-chalk sm:w-40 sm:text-sm">
              {team.name}
            </div>
            <div
              className="relative h-8 min-w-0 flex-1 overflow-visible rounded-md bg-turf-700 sm:h-9"
              style={YARD_LINES_STYLE}
            >
              <div className="absolute inset-y-0 right-0 flex w-[10%] items-center justify-center overflow-hidden rounded-r-md bg-gradient-to-l from-endzone-600 to-endzone-600/60 text-xs">
                🏁
              </div>
              <div
                key={pulseKey}
                className="absolute top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center transition-[left] duration-100 ease-linear will-change-[left] sm:h-14 sm:w-14"
                style={{ left: `calc(${(pos?.progress ?? 0) * 90}% - ${(pos?.progress ?? 0) * 40}px)` }}
              >
                {pulseKey !== undefined && (
                  <span className="absolute inline-flex h-2/3 w-2/3 animate-ping rounded-full bg-gold-500/60" />
                )}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={sprite}
                  alt=""
                  className="relative h-full w-full object-contain drop-shadow-[0_2px_3px_rgba(0,0,0,0.5)]"
                />
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
