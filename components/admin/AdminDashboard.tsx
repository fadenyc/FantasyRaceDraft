"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Claim, PublicSeason, Team } from "@/lib/db/types";
import { createBrowserClient } from "@/lib/supabase/client";
import { GRACE_PERIOD_MINUTES } from "@/lib/constants";
import { TeamRosterEditor } from "./TeamRosterEditor";
import { ScheduleForm } from "./ScheduleForm";
import { CommitPanel } from "./CommitPanel";
import { RaceResultsTable } from "@/components/race/RaceResultsTable";
import { SnakeDraftBoard } from "@/components/race/SnakeDraftBoard";
import { FairnessExplainer } from "@/components/shared/FairnessExplainer";
import { PresenceAvatars } from "@/components/shared/PresenceAvatars";
import { usePresence } from "@/components/shared/usePresence";
import { Countdown } from "@/components/shared/Countdown";

interface AdminDashboardProps {
  /** Base admin API path — `/api/admin/{adminToken}` (legacy) or `/api/dashboard/{seasonId}` (owned). */
  apiBase: string;
  season: PublicSeason;
  teams: Team[];
  claims: Claim[];
  publicUrl: string;
  /** The shareable admin link, or null for an owned season — those manage access purely via being signed in, nothing to copy/share. */
  adminUrl: string | null;
  qrCodeDataUrl: string;
}

export function AdminDashboard({
  apiBase,
  season,
  teams,
  claims: initialClaims,
  publicUrl,
  adminUrl,
  qrCodeDataUrl,
}: AdminDashboardProps) {
  const router = useRouter();
  const [claims, setClaims] = useState(initialClaims);
  const [copiedLink, setCopiedLink] = useState<"public" | "admin" | null>(null);
  const [sessionKey] = useState(() => crypto.randomUUID());
  const presence = usePresence(`presence:${season.public_token}`, sessionKey, "Commissioner");

  useEffect(() => {
    const supabase = createBrowserClient();
    const channel = supabase
      .channel(`admin-claims:${season.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "claims", filter: `season_id=eq.${season.id}` },
        ({ new: row }) => setClaims((prev) => [...prev, row as Claim]),
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "claims", filter: `season_id=eq.${season.id}` },
        ({ old: row }) => setClaims((prev) => prev.filter((c) => c.id !== (row as Claim).id)),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [season.id]);

  // Auto-starts the race once the grace period after the scheduled time
  // elapses. Runs from whichever browser has this dashboard open (token
  // link or signed-in owner session — either way, this component doesn't
  // need to know which). Re-checks every tick rather than firing once at a
  // computed timeout, so it self-corrects even if this tab was opened
  // after the grace period already passed — no need for the commissioner's
  // tab to be open at the exact right second.
  const hasAutoStartedRef = useRef(false);
  useEffect(() => {
    if (season.status !== "committed" || !season.scheduled_at) return;
    hasAutoStartedRef.current = false;
    const graceEndMs = new Date(season.scheduled_at).getTime() + GRACE_PERIOD_MINUTES * 60_000;

    const id = setInterval(() => {
      if (hasAutoStartedRef.current || Date.now() < graceEndMs) return;
      hasAutoStartedRef.current = true;
      fetch(`${apiBase}/start`, { method: "POST" })
        .then((res) => {
          router.refresh();
          if (!res.ok) hasAutoStartedRef.current = false;
        })
        .catch(() => {
          hasAutoStartedRef.current = false;
        });
    }, 1000);

    return () => clearInterval(id);
  }, [season.status, season.scheduled_at, apiBase, router]);

  function copy(url: string, which: "public" | "admin") {
    navigator.clipboard.writeText(url);
    setCopiedLink(which);
    setTimeout(() => setCopiedLink(null), 1500);
  }

  const teamNameById = Object.fromEntries(teams.map((t) => [t.id, t.name]));

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-2xl flex-col gap-8 p-6">
      <div>
        {adminUrl === null && (
          <Link href="/dashboard" className="text-xs text-chalk-faint hover:text-chalk hover:underline">
            ← My Seasons
          </Link>
        )}
        <h1 className="font-display text-4xl tracking-wide text-chalk">{season.name}</h1>
        <span className="text-xs uppercase tracking-wide text-chalk-faint">{season.status}</span>
      </div>

      <div className="flex min-w-0 flex-col gap-4 rounded-xl border border-turf-700 bg-turf-800/50 p-4 sm:flex-row">
        <Image
          src={qrCodeDataUrl}
          alt="QR code linking to the public join page"
          width={240}
          height={240}
          unoptimized
          className="h-32 w-32 shrink-0 rounded-lg border border-turf-700"
        />
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-3">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-wide text-chalk-faint">
                Share with your league
              </div>
              <div className="truncate text-sm text-chalk">{publicUrl}</div>
            </div>
            <button
              type="button"
              onClick={() => copy(publicUrl, "public")}
              className="shrink-0 rounded-full border border-turf-600 px-3 py-2 text-xs text-chalk hover:bg-turf-700"
            >
              {copiedLink === "public" ? "Copied" : "Copy"}
            </button>
          </div>
          {adminUrl ? (
            <div className="flex min-w-0 items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-wide text-endzone-400">
                  Admin link — never share this
                </div>
                <div className="truncate text-sm text-chalk">{adminUrl}</div>
              </div>
              <button
                type="button"
                onClick={() => copy(adminUrl, "admin")}
                className="shrink-0 rounded-full border border-turf-600 px-3 py-2 text-xs text-chalk hover:bg-turf-700"
              >
                {copiedLink === "admin" ? "Copied" : "Copy"}
              </button>
            </div>
          ) : (
            <div className="text-xs text-chalk-faint">
              🔒 Only you can manage this season — you&apos;re signed in as the owner.
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-chalk-muted">
        <span>{claims.length} / {teams.length} teams claimed</span>
        <PresenceAvatars entries={presence} />
      </div>

      {season.status === "setup" && (
        <>
          <TeamRosterEditor apiBase={apiBase} teams={teams} onSaved={() => router.refresh()} />
          <ScheduleForm
            apiBase={apiBase}
            scheduledAt={season.scheduled_at}
            raceDurationSeconds={season.race_duration_seconds ?? 60}
            snakeDraftRounds={season.snake_draft_rounds ?? null}
            onSaved={() => router.refresh()}
          />
          <CommitPanel apiBase={apiBase} onCommitted={() => router.refresh()} />
        </>
      )}

      {season.status === "committed" && (
        <>
          <div className="rounded-xl border border-turf-700 bg-turf-800/50 p-4 text-sm">
            <div className="mb-2 font-display text-lg tracking-wide text-chalk">Roster (locked)</div>
            <ul className="grid grid-cols-2 gap-1 text-chalk-muted sm:grid-cols-3">
              {teams.map((t) => (
                <li key={t.id}>{t.name}</li>
              ))}
            </ul>
          </div>
          <ScheduleForm
            apiBase={apiBase}
            scheduledAt={season.scheduled_at}
            raceDurationSeconds={season.race_duration_seconds ?? 60}
            snakeDraftRounds={season.snake_draft_rounds ?? null}
            onSaved={() => router.refresh()}
          />
          {season.scheduled_at && <Countdown targetIso={season.scheduled_at} committed />}
          <StartRaceButton apiBase={apiBase} onStarted={() => router.refresh()} />
          <p className="text-center text-xs text-chalk-faint">
            {season.scheduled_at
              ? `The race auto-starts ${GRACE_PERIOD_MINUTES} minutes after the scheduled time — or click above to start it right now.`
              : "No schedule set, so this won't auto-start — click above whenever you're ready."}
          </p>
        </>
      )}

      {season.status === "revealed" && season.final_order && (
        <div className="flex flex-col gap-4">
          <h2 className="font-display text-2xl tracking-wide text-chalk">Final draft order</h2>
          <RaceResultsTable finalOrder={season.final_order} teamNameById={teamNameById} seasonName={season.name} />
          {season.snake_draft_rounds && (
            <SnakeDraftBoard
              finalOrder={season.final_order}
              teamNameById={teamNameById}
              rounds={season.snake_draft_rounds}
              seasonName={season.name}
            />
          )}
        </div>
      )}

      <FairnessExplainer
        commitmentHash={season.commitment_hash}
        commitmentPublishedAt={season.commitment_published_at}
        serverSeed={season.server_seed}
        revealSeedUint32={season.reveal_seed_uint32}
      />
    </div>
  );
}

function StartRaceButton({ apiBase, onStarted }: { apiBase: string; onStarted: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setSubmitting(true);
    setError(null);
    const res = await fetch(`${apiBase}/start`, { method: "POST" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to start the race.");
      setSubmitting(false);
      return;
    }
    onStarted();
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={start}
        disabled={submitting}
        className="rounded-full bg-endzone-500 px-4 py-3 font-display text-lg tracking-wide text-chalk hover:bg-endzone-600 disabled:opacity-50"
      >
        {submitting ? "Starting…" : "Start Race 🏈"}
      </button>
      {error && <p className="text-sm text-endzone-400">{error}</p>}
    </div>
  );
}
