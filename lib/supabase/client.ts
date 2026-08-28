import { createBrowserClient as createSupabaseBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let singleton: SupabaseClient | undefined;

/**
 * Anon-key browser client — restricted by grants to the `public_seasons`
 * view plus `teams`/`claims`/`chat_messages`, and (once signed in) the
 * user's own auth session. Used for reads, `postgres_changes`
 * subscriptions, Realtime Broadcast (race sync, cheer button), and auth.
 * Never used for writes to app data; those go through Route Handlers.
 *
 * Always returns the same instance. Each Supabase client owns its own
 * GoTrue auth client, and multiple instances writing to the same
 * localStorage session key concurrently is exactly what Supabase's
 * "Multiple GoTrueClient instances detected" warning is about — harmless
 * before auth sessions mattered, a real risk of session desync now that
 * they do.
 */
export function createBrowserClient(): SupabaseClient {
  if (singleton) return singleton;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.",
    );
  }

  singleton = createSupabaseBrowserClient(url, anonKey);
  return singleton;
}
