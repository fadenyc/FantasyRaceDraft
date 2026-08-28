"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "ffdraft:soundEnabled";

/**
 * Sound is opt-in and defaults off — nobody should get an unexpected crowd
 * murmur the first time they open a link, especially on a video call.
 * Toggling on is also the user gesture that unlocks the AudioContext under
 * browser autoplay policy, so this doubles as the "enable audio" action.
 *
 * Starts false on every render pass (server and first client render alike)
 * and only syncs from localStorage in an effect after mount — a returning
 * visitor's stored "true" can't be read during the lazy-init render without
 * mismatching the server's markup, since the server has no localStorage to
 * read at all.
 */
export function useSoundEnabled(): [boolean, () => void] {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    try {
      // One-time sync from a post-hydration-only source (localStorage) —
      // not a state loop, this never re-runs.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEnabled(window.localStorage.getItem(STORAGE_KEY) === "true");
    } catch {
      // Private browsing / blocked storage — stays at the false default.
    }
  }, []);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // Private browsing / blocked storage — the toggle still works for this session.
      }
      return next;
    });
  }, []);

  return [enabled, toggle];
}
