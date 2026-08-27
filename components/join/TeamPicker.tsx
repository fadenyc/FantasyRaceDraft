"use client";

import type { Team } from "@/lib/db/types";

interface TeamPickerProps {
  teams: Team[];
  claimedTeamIds: Set<string>;
  myTeamId: string | null;
  onClaim: (teamId: string) => void;
  onRelease: () => void;
  busy: boolean;
}

export function TeamPicker({ teams, claimedTeamIds, myTeamId, onClaim, onRelease, busy }: TeamPickerProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl tracking-wide text-chalk">Which team are you?</h2>
        {myTeamId && (
          <button
            type="button"
            onClick={onRelease}
            disabled={busy}
            className="text-xs text-chalk-faint underline hover:text-chalk disabled:opacity-50"
          >
            Not you? Release claim
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {teams.map((team) => {
          const isMine = myTeamId === team.id;
          const isClaimedByOther = !isMine && claimedTeamIds.has(team.id);
          return (
            <button
              key={team.id}
              type="button"
              disabled={busy || isClaimedByOther || Boolean(myTeamId)}
              onClick={() => onClaim(team.id)}
              className={`min-w-0 rounded-lg border px-3 py-2 text-left text-sm transition ${
                isMine
                  ? "border-endzone-500 bg-endzone-500/15 font-semibold text-chalk"
                  : isClaimedByOther
                    ? "cursor-not-allowed border-turf-700 bg-turf-800/50 text-chalk-faint"
                    : "border-turf-600 bg-turf-800/50 text-chalk hover:border-field-500 hover:bg-turf-700"
              } ${myTeamId && !isMine ? "cursor-not-allowed opacity-50" : ""}`}
            >
              <div className="truncate">{team.name}</div>
              <div className="text-[10px] uppercase tracking-wide text-chalk-faint">
                {isMine ? "This is you" : isClaimedByOther ? "Claimed" : "Available"}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
