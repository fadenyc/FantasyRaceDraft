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
  // Mirrors the latest `label` prop outside the mount-time effect closure,
  // so the SUBSCRIBED and visibility handlers below (which don't re-run
  // when label changes) always re-track the current label instead of a
  // stale one captured at mount.
  const labelRef = useRef(label);
  useEffect(() => {
    labelRef.current = label;
  }, [label]);

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
        channel.track({ label: labelRef.current });
      }
    });

    // Mobile browsers (iOS Safari in particular) throttle or fully suspend
    // a backgrounded tab's JS timers and websockets — someone who locks
    // their phone or switches apps for a bit can come back to a presence
    // list that's stale until something wakes the connection back up.
    // Re-tracking on visibility regain both nudges our own entry current
    // and, since it's a live round-trip on the channel, forces a fresh
    // sync from the server — cheap enough to just always do rather than
    // try to detect whether the socket actually dropped.
    function handleVisibilityChange() {
      if (document.visibilityState === "visible" && joinedRef.current) {
        channel.track({ label: labelRef.current });
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      channelRef.current = null;
      joinedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [channelName, identityKey]);

  // Re-broadcast the label (e.g. after claiming a team) without tearing down the channel.
  useEffect(() => {
    if (joinedRef.current) channelRef.current?.track({ label });
  }, [label]);

  return entries;
}
