import "server-only";
import { createClient } from "@supabase/supabase-js";

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
