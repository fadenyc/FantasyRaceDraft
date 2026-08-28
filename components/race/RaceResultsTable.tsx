"use client";

import { useState } from "react";

interface RaceResultsTableProps {
  finalOrder: string[];
  teamNameById: Record<string, string>;
  /** Shown in the copied text's header line, if provided. */
  seasonName?: string;
}

function buildShareText(finalOrder: string[], teamNameById: Record<string, string>, seasonName?: string): string {
  const lines = finalOrder.map((teamId, index) => `${index + 1}. ${teamNameById[teamId] ?? "Unknown team"}`);
  const header = seasonName ? `🏈 ${seasonName} — Final Draft Order` : "🏈 Final Draft Order";
  return [header, ...lines].join("\n");
}

export function RaceResultsTable({ finalOrder, teamNameById, seasonName }: RaceResultsTableProps) {
  const [copied, setCopied] = useState(false);

  async function copyResults() {
    await navigator.clipboard.writeText(buildShareText(finalOrder, teamNameById, seasonName));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-xl border border-turf-700">
        <table className="w-full text-sm">
          <thead className="bg-turf-800">
            <tr>
              <th className="px-4 py-2 text-left font-display text-base font-normal tracking-wide text-chalk-muted">
                Pick
              </th>
              <th className="px-4 py-2 text-left font-display text-base font-normal tracking-wide text-chalk-muted">
                Team
              </th>
            </tr>
          </thead>
          <tbody>
            {finalOrder.map((teamId, index) => (
              <tr key={teamId} className="border-t border-turf-700">
                <td className="px-4 py-2 font-bold tabular-nums text-gold-500">{index + 1}</td>
                <td className="px-4 py-2 text-chalk">{teamNameById[teamId] ?? "Unknown team"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={copyResults}
        className="w-fit rounded-full border border-turf-600 px-4 py-2 text-xs font-medium text-chalk hover:bg-turf-700"
      >
        {copied ? "Copied!" : "Copy results"}
      </button>
    </div>
  );
}
