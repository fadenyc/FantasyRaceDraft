"use client";

import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createBrowserClient } from "@/lib/supabase/client";

export interface PresenceEntry {
  key: string;
  label: string;
}

/** Live "who's watching" — tracks this viewer's presence on a channel and returns everyone currently present. */
export function usePresence(channelName: string, identityKey: string | null, label: string): PresenceEntry[] {
  const [entries, setEntries] = useState<PresenceEntry[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const joinedRef = useRef(false);

  useEffect(() => {
    if (!identityKey) return;
    const supabase = createBrowserClient();
    const channel = supabase.channel(channelName, { config: { presence: { key: identityKey } } });
    channelRef.current = channel;
    joinedRef.current = false;

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState() as Record<string, Array<{ label?: string }>>;
      setEntries(Object.entries(state).map(([key, list]) => ({ key, label: list[0]?.label ?? "Guest" })));
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        joinedRef.current = true;
        // Uses the label captured when this effect instance was created (i.e. at mount);
        // later label changes are re-broadcast by the effect below without rejoining the channel.
        channel.track({ label });
      }
    });

    return () => {
      channelRef.current = null;
      joinedRef.current = false;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, identityKey]);

  // Re-broadcast the label (e.g. after claiming a team) without tearing down the channel.
  useEffect(() => {
    if (joinedRef.current) channelRef.current?.track({ label });
  }, [label]);

  return entries;
}
