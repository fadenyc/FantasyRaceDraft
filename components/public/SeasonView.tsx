"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Claim, PublicSeason, Team } from "@/lib/db/types";
import { createBrowserClient } from "@/lib/supabase/client";
import { RaceCanvas } from "@/components/race/RaceCanvas";
import { RaceResultsTable } from "@/components/race/RaceResultsTable";
import { FloatingEmojiOverlay, type EmojiBurst } from "@/components/race/FloatingEmoji";
import type { ClockMode } from "@/components/race/raceClockMode";
import { TeamPicker } from "@/components/join/TeamPicker";
import { useClientToken } from "@/components/join/useClientToken";
import { FairnessExplainer } from "@/components/shared/FairnessExplainer";
import { PresenceAvatars } from "@/components/shared/PresenceAvatars";
import { usePresence } from "@/components/shared/usePresence";
import { Countdown } from "@/components/shared/Countdown";

interface SeasonViewProps {
  publicToken: string;
  initialSeason: PublicSeason;
  initialTeams: Team[];
  initialClaims: Claim[];
}

interface RaceStartPayload {
  revealSeedUint32: number;
  finalOrder: string[];
  raceStartAt: string;
}

const CHEER_EMOJIS = ["🏈", "🏈", "🏈", "🎉", "🔥", "👏"];
function randomCheerEmoji(): string {
  return CHEER_EMOJIS[Math.floor(Math.random() * CHEER_EMOJIS.length)];
}

export function SeasonView({ publicToken, initialSeason, initialTeams, initialClaims }: SeasonViewProps) {
  const [supabase] = useState(() => createBrowserClient());
  const [season, setSeason] = useState(initialSeason);
  const [claims, setClaims] = useState<Claim[]>(initialClaims);
  const [busy, setBusy] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [cheerPulses, setCheerPulses] = useState<Record<string, number>>({});
  const [floaters, setFloaters] = useState<EmojiBurst[]>([]);
  const [raceComplete, setRaceComplete] = useState(false);
  const clientToken = useClientToken(publicToken);
  const broadcastChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const teams = initialTeams; // roster is immutable once players are picking; commissioner edits pre-commit only
  const teamNameById = useMemo(
    () => Object.fromEntries(teams.map((t) => [t.id, t.name])),
    [teams],
  );
  const claimedTeamIds = useMemo(() => new Set(claims.map((c) => c.team_id)), [claims]);
  const myTeamId = useMemo(
    () => claims.find((c) => c.client_token === clientToken)?.team_id ?? null,
    [claims, clientToken],
  );

  const presence = usePresence(
    `presence:${publicToken}`,
    clientToken,
    myTeamId ? teamNameById[myTeamId] : "Guest",
  );

  useEffect(() => {
    const channel = supabase
      .channel(`season:${publicToken}`, { config: { broadcast: { self: true } } })
      .on("broadcast", { event: "race_start" }, ({ payload }) => {
        const p = payload as RaceStartPayload;
        setSeason((prev) => ({
          ...prev,
          status: "revealed",
          reveal_seed_uint32: p.revealSeedUint32,
          final_order: p.finalOrder,
          revealed_at: p.raceStartAt,
        }));
      })
      .on("broadcast", { event: "cheer" }, ({ payload }) => {
        const teamId = (payload as { teamId: string }).teamId;
        setCheerPulses((prev) => ({ ...prev, [teamId]: Date.now() }));
        setFloaters((prev) => [
          ...prev,
          { id: crypto.randomUUID(), emoji: randomCheerEmoji(), xPercent: Math.random() * 80 + 10 },
        ]);
      })
      .subscribe();
    broadcastChannelRef.current = channel;

    const claimsChannel = supabase
      .channel(`claims:${season.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "claims", filter: `season_id=eq.${season.id}` },
        ({ new: row }) => setClaims((prev) => [...prev, row as Claim]),
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "claims", filter: `season_id=eq.${season.id}` },
        ({ old: row }) =>
          setClaims((prev) => prev.filter((c) => c.id !== (row as Claim).id)),
      )
      .subscribe();

    return () => {
      broadcastChannelRef.current = null;
      supabase.removeChannel(channel);
      supabase.removeChannel(claimsChannel);
    };
  }, [supabase, publicToken, season.id]);

  async function claimTeam(teamId: string) {
    if (!clientToken) return;
    setBusy(true);
    setClaimError(null);
    try {
      const res = await fetch(`/api/seasons/${publicToken}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, clientToken }),
      });
      if (res.ok) {
        setClaims((prev) => [
          ...prev,
          { id: crypto.randomUUID(), team_id: teamId, season_id: season.id, client_token: clientToken, claimed_at: new Date().toISOString() },
        ]);
      } else {
        const body = await res.json().catch(() => ({}));
        setClaimError(body.error ?? "Couldn't claim that team — try again.");
      }
    } catch {
      setClaimError("Couldn't reach the server — check your connection and try again.");
    }
    setBusy(false);
  }

  async function releaseClaim() {
    if (!clientToken || !myTeamId) return;
    setBusy(true);
    setClaimError(null);
    try {
      const res = await fetch(`/api/seasons/${publicToken}/claim`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: myTeamId, clientToken }),
      });
      if (res.ok) {
        setClaims((prev) => prev.filter((c) => c.team_id !== myTeamId));
      } else {
        const body = await res.json().catch(() => ({}));
        setClaimError(body.error ?? "Couldn't release that claim — try again.");
      }
    } catch {
      setClaimError("Couldn't reach the server — check your connection and try again.");
    }
    setBusy(false);
  }

  function cheer(teamId: string) {
    broadcastChannelRef.current?.send({ type: "broadcast", event: "cheer", payload: { teamId } });
  }

  function removeFloater(id: string) {
    setFloaters((prev) => prev.filter((f) => f.id !== id));
  }

  const clockMode: ClockMode =
    season.status === "revealed" && season.revealed_at
      ? { mode: "live", raceStartAt: season.revealed_at }
      : { mode: "idle" };

  const raceIsShowing = season.status === "revealed" && season.final_order && season.reveal_seed_uint32 !== null;

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-2xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-4xl tracking-wide text-chalk">{season.name}</h1>
        {season.scheduled_at && (
          <p className="text-sm text-chalk-muted">
            Scheduled for {new Date(season.scheduled_at).toLocaleString()}
          </p>
        )}
        <PresenceAvatars entries={presence} />
      </div>

      {!raceIsShowing && season.scheduled_at && (
        <Countdown targetIso={season.scheduled_at} committed={season.status !== "setup"} />
      )}

      {raceIsShowing ? (
        <div className="flex flex-col gap-4">
          <div className="relative">
            <RaceCanvas
              teams={teams}
              finalOrder={season.final_order as string[]}
              seed={season.reveal_seed_uint32 as number}
              mode={clockMode}
              cheerPulses={cheerPulses}
              onComplete={() => setRaceComplete(true)}
            />
            <FloatingEmojiOverlay bursts={floaters} onComplete={removeFloater} />
          </div>
          <div className="flex flex-wrap gap-2">
            {teams.map((team) => (
              <button
                key={team.id}
                type="button"
                onClick={() => cheer(team.id)}
                className="rounded-full border border-turf-600 bg-turf-800 px-3 py-2 text-xs text-chalk hover:border-endzone-500 hover:bg-turf-700"
              >
                🏈 {team.name}
              </button>
            ))}
          </div>
          {raceComplete && (
            <div>
              <h2 className="mb-2 font-display text-2xl tracking-wide text-chalk">Final draft order</h2>
              <RaceResultsTable finalOrder={season.final_order as string[]} teamNameById={teamNameById} />
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <TeamPicker
            teams={teams}
            claimedTeamIds={claimedTeamIds}
            myTeamId={myTeamId}
            onClaim={claimTeam}
            onRelease={releaseClaim}
            busy={busy}
          />
          {claimError && <p className="text-sm text-endzone-400">{claimError}</p>}
        </div>
      )}

      <FairnessExplainer
        commitmentHash={season.commitment_hash}
        commitmentPublishedAt={season.commitment_published_at}
        serverSeed={season.status === "revealed" ? season.server_seed : null}
        revealSeedUint32={season.reveal_seed_uint32}
      />
    </div>
  );
}
