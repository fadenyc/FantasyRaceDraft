"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage, Team } from "@/lib/db/types";
import { createBrowserClient } from "@/lib/supabase/client";
import { TeamAvatar } from "./TeamAvatar";

interface ChatPanelProps {
  publicToken: string;
  seasonId: string;
  teams: Team[];
  initialMessages: ChatMessage[];
  clientToken: string | null;
}

const MAX_MESSAGE_LENGTH = 240;

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function ChatPanel({ publicToken, seasonId, teams, initialMessages, clientToken }: ChatPanelProps) {
  const [supabase] = useState(() => createBrowserClient());
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // clientToken resolves to a real value on the client almost immediately,
  // but the server render always sees it as unavailable. Branching the
  // input's disabled/placeholder directly on clientToken would make the
  // very first client render disagree with the server-rendered HTML —
  // React detects that mismatch and leaves the stale (disabled) DOM in
  // place rather than patching it, so the input would stay stuck forever.
  // Rendering "not ready" through the first client render (matching SSR
  // exactly), then flipping via an effect once mounted, avoids that.
  // Also gates the per-message toLocaleTimeString() calls below — those
  // format by the runtime's timezone/locale, which differs between server
  // and a visitor's browser, so they can't render until after mount either.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // Deliberately only flips post-hydration — that's the entire point of
    // this flag, so it can't be reached via a lazy useState initializer
    // (which runs identically on the server and the client's first render).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);
  const ready = mounted && Boolean(clientToken);

  const teamIndexById = useMemo(() => new Map(teams.map((t, i) => [t.id, i])), [teams]);
  const teamNameById = useMemo(() => new Map(teams.map((t) => [t.id, t.name])), [teams]);

  useEffect(() => {
    const channel = supabase
      .channel(`chat:${seasonId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `season_id=eq.${seasonId}` },
        ({ new: row }) => setMessages((prev) => [...prev, row as ChatMessage]),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, seasonId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!clientToken || !text) return;

    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/seasons/${publicToken}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientToken, body: text }),
      });
      if (res.ok) {
        setDraft("");
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Couldn't send that.");
      }
    } catch {
      setError("Couldn't reach the server — check your connection.");
    }
    setSending(false);
  }

  return (
    <div className="flex h-72 flex-col rounded-xl border border-turf-700 bg-turf-800/50 lg:h-full">
      <div className="border-b border-turf-700 px-4 py-2 font-display text-lg tracking-wide text-chalk">
        🗣️ Trash Talk
      </div>
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {messages.length === 0 && (
          <p className="text-xs text-chalk-faint">No messages yet — say something.</p>
        )}
        {messages.map((message) => {
          const teamIndex = message.team_id ? teamIndexById.get(message.team_id) ?? null : null;
          const teamName = message.team_id ? teamNameById.get(message.team_id) ?? "Unknown team" : "Guest";
          return (
            <div key={message.id} className="flex items-start gap-2">
              <TeamAvatar teamIndex={teamIndex} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="truncate text-xs font-semibold text-chalk">{teamName}</span>
                  <span className="shrink-0 text-[10px] text-chalk-faint">
                    {mounted ? formatTime(message.created_at) : ""}
                  </span>
                </div>
                <div className="break-words text-sm text-chalk-muted">{message.body}</div>
              </div>
            </div>
          );
        })}
      </div>
      <form onSubmit={send} className="flex flex-col gap-1 border-t border-turf-700 p-2">
        <div className="flex gap-2">
          <input
            data-testid="chat-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={MAX_MESSAGE_LENGTH}
            placeholder={ready ? "Talk some trash…" : "Setting up…"}
            disabled={!ready}
            className="min-w-0 flex-1 rounded-lg border border-turf-600 bg-turf-900 px-3 py-2 text-sm text-chalk placeholder:text-chalk-faint disabled:opacity-50"
          />
          <button
            data-testid="chat-send"
            type="submit"
            disabled={sending || !draft.trim() || !ready}
            className="shrink-0 rounded-lg bg-endzone-500 px-3 py-2 text-sm font-semibold text-chalk hover:bg-endzone-600 disabled:opacity-50"
          >
            Send
          </button>
        </div>
        {error && <p className="text-xs text-endzone-400">{error}</p>}
      </form>
    </div>
  );
}
