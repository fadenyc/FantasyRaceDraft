"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage, Claim, PublicSeason, Team } from "@/lib/db/types";
import { createBrowserClient } from "@/lib/supabase/client";
import { RaceCanvas } from "@/components/race/RaceCanvas";
import { RaceResultsTable } from "@/components/race/RaceResultsTable";
import { SnakeDraftBoard } from "@/components/race/SnakeDraftBoard";
import { FloatingEmojiOverlay, type EmojiBurst } from "@/components/race/FloatingEmoji";
import type { ClockMode } from "@/components/race/raceClockMode";
import { TeamPicker } from "@/components/join/TeamPicker";
import { useClientToken } from "@/components/join/useClientToken";
import { FairnessExplainer } from "@/components/shared/FairnessExplainer";
import { PresenceAvatars } from "@/components/shared/PresenceAvatars";
import { usePresence } from "@/components/shared/usePresence";
import { Countdown } from "@/components/shared/Countdown";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { GRACE_PERIOD_MINUTES } from "@/lib/constants";
import { useSoundEnabled } from "@/components/shared/useSoundEnabled";
import { playAirHorn, playChime, playTap, playWhistle, startCrowdMurmur, stopCrowdMurmur } from "@/lib/audio/sfx";

interface SeasonViewProps {
  publicToken: string;
  initialSeason: PublicSeason;
  initialTeams: Team[];
  initialClaims: Claim[];
  initialMessages: ChatMessage[];
}

interface RaceStartPayload {
  revealSeedUint32: number;
  finalOrder: string[];
  raceStartAt: string;
}

const REACTION_EMOJIS = ["🏈", "👏", "🔥", "🏃", "🍺", "🎉", "💪", "😂"];

const ORDINALS = [
  "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th", "11th", "12th",
  "13th", "14th", "15th", "16th", "17th", "18th", "19th", "20th", "21st", "22nd", "23rd", "24th",
];
function ordinal(rank: number): string {
  return ORDINALS[rank - 1] ?? `${rank}th`;
}

export function SeasonView({
  publicToken,
  initialSeason,
  initialTeams,
  initialClaims,
  initialMessages,
}: SeasonViewProps) {
  const [supabase] = useState(() => createBrowserClient());
  const [season, setSeason] = useState(initialSeason);
  const [claims, setClaims] = useState<Claim[]>(initialClaims);
  const [busy, setBusy] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [floaters, setFloaters] = useState<EmojiBurst[]>([]);
  const [raceComplete, setRaceComplete] = useState(false);
  const [soundEnabled, toggleSound] = useSoundEnabled();
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
  const myPickNumber = useMemo(() => {
    if (!myTeamId || !season.final_order) return null;
    const index = (season.final_order as string[]).indexOf(myTeamId);
    return index === -1 ? null : index + 1;
  }, [myTeamId, season.final_order]);

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
        const emoji = (payload as { emoji: string }).emoji;
        setFloaters((prev) => [
          ...prev,
          { id: crypto.randomUUID(), emoji, xPercent: Math.random() * 80 + 10 },
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

  // Nudges the race to start once the grace period elapses, same as the
  // commissioner's dashboard does — but from here, so it fires even if the
  // commissioner isn't around to click anything. Whoever's waiting-room tab
  // is open when the clock runs out triggers it for everyone; the endpoint
  // is time-gated and idempotent (a 409 here just means someone else's tab
  // already did it), so any number of open tabs polling is harmless.
  const hasAutoStartedRef = useRef(false);
  useEffect(() => {
    if (season.status !== "committed" || !season.scheduled_at) return;
    hasAutoStartedRef.current = false;
    const graceEndMs = new Date(season.scheduled_at).getTime() + GRACE_PERIOD_MINUTES * 60_000;

    const id = setInterval(() => {
      if (hasAutoStartedRef.current || Date.now() < graceEndMs) return;
      hasAutoStartedRef.current = true;
      fetch(`/api/seasons/${publicToken}/auto-start`, { method: "POST" })
        .then((res) => {
          if (!res.ok) hasAutoStartedRef.current = false;
        })
        .catch(() => {
          hasAutoStartedRef.current = false;
        });
    }, 1000);

    return () => clearInterval(id);
  }, [season.status, season.scheduled_at, publicToken]);

  const raceIsShowing = season.status === "revealed" && season.final_order && season.reveal_seed_uint32 !== null;

  // Ambient stadium hum while everyone's waiting — stops the moment the race starts.
  useEffect(() => {
    if (!soundEnabled || raceIsShowing) {
      stopCrowdMurmur();
      return;
    }
    startCrowdMurmur();
    return () => stopCrowdMurmur();
  }, [soundEnabled, raceIsShowing]);

  const hasPlayedKickoffRef = useRef(false);
  useEffect(() => {
    if (!raceIsShowing) {
      hasPlayedKickoffRef.current = false;
      return;
    }
    if (soundEnabled && !hasPlayedKickoffRef.current) {
      hasPlayedKickoffRef.current = true;
      playWhistle();
    }
  }, [raceIsShowing, soundEnabled]);

  useEffect(() => {
    if (raceComplete && soundEnabled) playAirHorn();
  }, [raceComplete, soundEnabled]);

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
        if (soundEnabled) playChime();
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

  function cheer(emoji: string) {
    if (soundEnabled) playTap();
    broadcastChannelRef.current?.send({ type: "broadcast", event: "cheer", payload: { emoji } });
  }

  function removeFloater(id: string) {
    setFloaters((prev) => prev.filter((f) => f.id !== id));
  }

  const clockMode: ClockMode =
    season.status === "revealed" && season.revealed_at
      ? { mode: "live", raceStartAt: season.revealed_at }
      : { mode: "idle" };

  // Chat stays visible in the same right-side column across the whole
  // lifecycle — waiting room, live race, and results — so it never
  // disappears once the race starts.
  return (
    <div className="mx-auto flex w-full min-w-0 max-w-5xl flex-col gap-6 p-6">
      <div className="flex w-full items-start justify-between gap-2">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-4xl tracking-wide text-chalk">{season.name}</h1>
          {season.scheduled_at && (
            <p className="text-sm text-chalk-muted">
              Scheduled for {new Date(season.scheduled_at).toLocaleString()}
            </p>
          )}
          <PresenceAvatars entries={presence} />
        </div>
        <button
          type="button"
          onClick={toggleSound}
          aria-label={soundEnabled ? "Turn sound off" : "Turn sound on"}
          title={soundEnabled ? "Sound on" : "Sound off"}
          className="shrink-0 rounded-full border border-turf-600 bg-turf-800 px-3 py-2 text-lg hover:border-endzone-500 hover:bg-turf-700"
        >
          {soundEnabled ? "🔊" : "🔇"}
        </button>
      </div>

      {!raceIsShowing && season.scheduled_at && (
        <div className="w-full">
          <Countdown targetIso={season.scheduled_at} committed={season.status !== "setup"} />
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {raceIsShowing ? (
            <>
              <div className="relative">
                <RaceCanvas
                  teams={teams}
                  finalOrder={season.final_order as string[]}
                  seed={season.reveal_seed_uint32 as number}
                  mode={clockMode}
                  durationMs={(season.race_duration_seconds ?? 60) * 1000}
                  onComplete={() => setRaceComplete(true)}
                />
                <FloatingEmojiOverlay bursts={floaters} onComplete={removeFloater} />
              </div>
              <div className="flex flex-wrap gap-2">
                {REACTION_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => cheer(emoji)}
                    className="rounded-full border border-turf-600 bg-turf-800 px-3 py-2 text-lg hover:border-endzone-500 hover:bg-turf-700"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              {raceComplete && myPickNumber && (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-gold-500/40 bg-gold-500/10 px-6 py-6 text-center">
                  <div className="text-xs uppercase tracking-wide text-chalk-faint">Your result</div>
                  <h2 className="font-display text-3xl tracking-wide text-gold-500">
                    You&apos;re picking {ordinal(myPickNumber)}!
                  </h2>
                  <p className="text-sm text-chalk-muted">
                    Good luck this season, {teamNameById[myTeamId as string]} 🏈
                  </p>
                </div>
              )}
              {raceComplete && (
                <div>
                  <h2 className="mb-2 font-display text-2xl tracking-wide text-chalk">Final draft order</h2>
                  <RaceResultsTable
                    finalOrder={season.final_order as string[]}
                    teamNameById={teamNameById}
                    seasonName={season.name}
                  />
                </div>
              )}
              {raceComplete && season.snake_draft_rounds && (
                <SnakeDraftBoard
                  finalOrder={season.final_order as string[]}
                  teamNameById={teamNameById}
                  rounds={season.snake_draft_rounds}
                  seasonName={season.name}
                />
              )}
            </>
          ) : myTeamId ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-endzone-500/40 bg-endzone-500/10 px-6 py-10 text-center">
              <div className="text-xs uppercase tracking-wide text-chalk-faint">You&apos;re in the lobby</div>
              <h2 className="font-display text-3xl tracking-wide text-chalk">
                Drafting as {teamNameById[myTeamId]}
              </h2>
              <p className="text-sm text-chalk-muted">
                Hang tight — chat with your league on the right while you wait for the race to start.
              </p>
              <button
                type="button"
                onClick={releaseClaim}
                disabled={busy}
                className="text-xs text-chalk-faint underline hover:text-chalk disabled:opacity-50"
              >
                Not you? Release claim
              </button>
              {claimError && <p className="text-sm text-endzone-400">{claimError}</p>}
            </div>
          ) : (
            <>
              <TeamPicker
                teams={teams}
                claimedTeamIds={claimedTeamIds}
                myTeamId={myTeamId}
                onClaim={claimTeam}
                onRelease={releaseClaim}
                busy={busy}
              />
              {claimError && <p className="text-sm text-endzone-400">{claimError}</p>}
            </>
          )}
        </div>
        <div className="w-full lg:w-80 lg:shrink-0">
          <ChatPanel
            publicToken={publicToken}
            seasonId={season.id}
            teams={teams}
            initialMessages={initialMessages}
            clientToken={clientToken}
          />
        </div>
      </div>

      <div className="mx-auto w-full max-w-2xl">
        <FairnessExplainer
          commitmentHash={season.commitment_hash}
          commitmentPublishedAt={season.commitment_published_at}
          serverSeed={season.status === "revealed" ? season.server_seed : null}
          revealSeedUint32={season.reveal_seed_uint32}
        />
      </div>
    </div>
  );
}
