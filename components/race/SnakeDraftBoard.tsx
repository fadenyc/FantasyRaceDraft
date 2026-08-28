"use client";

import { useMemo, useState } from "react";

interface SnakeDraftBoardProps {
  finalOrder: string[];
  teamNameById: Record<string, string>;
  rounds: number;
  seasonName?: string;
}

interface SnakePick {
  overall: number;
  round: number;
  pickInRound: number;
  teamId: string;
}

/** Standard snake draft: odd rounds follow finalOrder, even rounds reverse it. */
function buildSnakeBoard(finalOrder: string[], rounds: number): SnakePick[] {
  const picks: SnakePick[] = [];
  let overall = 1;
  for (let round = 1; round <= rounds; round++) {
    const roundOrder = round % 2 === 1 ? finalOrder : [...finalOrder].reverse();
    roundOrder.forEach((teamId, i) => {
      picks.push({ overall, round, pickInRound: i + 1, teamId });
      overall++;
    });
  }
  return picks;
}

function buildShareText(picks: SnakePick[], teamNameById: Record<string, string>, seasonName?: string): string {
  const header = seasonName ? `🏈 ${seasonName} — Snake Draft Board` : "🏈 Snake Draft Board";
  const lines = picks.map(
    (p) => `${p.overall}. (R${p.round}.${p.pickInRound}) ${teamNameById[p.teamId] ?? "Unknown team"}`,
  );
  return [header, ...lines].join("\n");
}

export function SnakeDraftBoard({ finalOrder, teamNameById, rounds, seasonName }: SnakeDraftBoardProps) {
  const [copied, setCopied] = useState(false);
  const picks = useMemo(() => buildSnakeBoard(finalOrder, rounds), [finalOrder, rounds]);

  async function copyBoard() {
    await navigator.clipboard.writeText(buildShareText(picks, teamNameById, seasonName));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex flex-col gap-2">
      <h2 className="font-display text-2xl tracking-wide text-chalk">Full snake draft board</h2>
      <div className="max-h-96 overflow-y-auto rounded-xl border border-turf-700">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-turf-800">
            <tr>
              <th className="px-4 py-2 text-left font-display text-base font-normal tracking-wide text-chalk-muted">
                Pick
              </th>
              <th className="px-4 py-2 text-left font-display text-base font-normal tracking-wide text-chalk-muted">
                Round
              </th>
              <th className="px-4 py-2 text-left font-display text-base font-normal tracking-wide text-chalk-muted">
                Team
              </th>
            </tr>
          </thead>
          <tbody>
            {picks.map((p) => (
              <tr
                key={p.overall}
                className={`border-t border-turf-700 ${p.round % 2 === 0 ? "bg-turf-900/40" : ""}`}
              >
                <td className="px-4 py-2 font-bold tabular-nums text-gold-500">{p.overall}</td>
                <td className="px-4 py-2 tabular-nums text-chalk-muted">
                  R{p.round}.{p.pickInRound}
                </td>
                <td className="px-4 py-2 text-chalk">{teamNameById[p.teamId] ?? "Unknown team"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={copyBoard}
        className="w-fit rounded-full border border-turf-600 px-4 py-2 text-xs font-medium text-chalk hover:bg-turf-700"
      >
        {copied ? "Copied!" : "Copy full board"}
      </button>
    </div>
  );
}
