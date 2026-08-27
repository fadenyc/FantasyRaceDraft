import { createClient } from "@supabase/supabase-js";

/**
 * Anon-key client — browser-safe, restricted by grants to the
 * `public_seasons` view plus `teams`/`claims`. Used for reads,
 * `postgres_changes` subscriptions, and Realtime Broadcast (race sync,
 * cheer button). Never used for writes; those go through Route Handlers.
 */
export function createBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.",
    );
  }

  return createClient(url, anonKey);
}
