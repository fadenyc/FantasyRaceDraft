import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Service-role client — full DB access, bypasses RLS/view restrictions.
 * Only ever imported from Route Handlers, never shipped to the browser.
 * The `server-only` import above makes any accidental client import fail the build.
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

/**
 * Session-aware client — anon key, but reads/writes the visitor's auth
 * cookie via Next's `cookies()`. Use this (never the service-role client)
 * anywhere you need to know *who's currently logged in* — Server
 * Components, the `/new` create-season route, the owner-gated dashboard
 * routes. It has no elevated data access of its own; that's still the
 * service-role client's job.
 */
export async function createSessionClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.",
    );
  }

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component render — middleware is what
          // actually refreshes the session cookie on each request, so a
          // failed write here (no response to attach cookies to) is safe
          // to ignore.
        }
      },
    },
  });
}
