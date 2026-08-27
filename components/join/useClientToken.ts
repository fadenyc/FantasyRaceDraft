"use client";

import { useState } from "react";

/** Lightweight per-browser identity — no accounts, just enough to know "this is the same person" on return visits. */
export function useClientToken(publicToken: string): string {
  // Lazy initializer runs during the client render pass (window is available by
  // then), so the token is ready on first render with no effect/flash needed.
  // Falls back to an in-memory-only token if localStorage is blocked (private
  // browsing, strict privacy settings) — claiming still works, it just won't
  // be remembered on a reload.
  const [clientToken] = useState<string>(() => {
    if (typeof window === "undefined") return "";

    try {
      const key = `ffdraft:${publicToken}:clientToken`;
      const existing = window.localStorage.getItem(key);
      if (existing) return existing;
      const generated = crypto.randomUUID();
      window.localStorage.setItem(key, generated);
      return generated;
    } catch {
      return crypto.randomUUID();
    }
  });

  return clientToken;
}
