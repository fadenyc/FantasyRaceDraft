"use client";

import { useEffect, useState } from "react";

/**
 * Lightweight per-browser identity — no accounts, just enough to know "this
 * is the same person" on return visits.
 *
 * Starts as "" on every render pass, server and first client render alike,
 * and only reads/generates the real token in a post-mount effect. A lazy
 * useState initializer that reads localStorage during the first client
 * render would mismatch the server's markup for a returning visitor —
 * their real token resolves to a claimed team, which renders a different
 * branch (the lobby) than the server's claim-less "" render (the picker).
 * Callers that gate on clientToken being truthy (claim/release) already
 * treat "" as "not ready yet", so the brief empty window is harmless.
 */
export function useClientToken(publicToken: string): string {
  const [clientToken, setClientToken] = useState("");

  useEffect(() => {
    let token: string;
    try {
      const key = `ffdraft:${publicToken}:clientToken`;
      const existing = window.localStorage.getItem(key);
      if (existing) {
        token = existing;
      } else {
        token = crypto.randomUUID();
        window.localStorage.setItem(key, token);
      }
    } catch {
      token = crypto.randomUUID();
    }
    // One-time sync from a post-hydration-only source (localStorage) — not a state loop, this never re-runs for the same publicToken.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setClientToken(token);
  }, [publicToken]);

  return clientToken;
}
