import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "../supabase/server";
import type { Claim, Season, Team } from "./types";

/** Looks up a season by its secret admin token. Returns null on no match (callers should 404, not leak which part failed). */
export async function getSeasonByAdminToken(
  supabase: SupabaseClient,
  adminToken: string,
): Promise<Season | null> {
  const { data, error } = await supabase
    .from("seasons")
    .select("*")
    .eq("admin_token", adminToken)
    .maybeSingle();

  if (error) throw error;
  return data as Season | null;
}

export interface AdminBundle {
  season: Season;
  teams: Team[];
  claims: Claim[];
}

export async function getAdminBundleByAdminToken(adminToken: string): Promise<AdminBundle | null> {
  const supabase = createServiceRoleClient();
  const season = await getSeasonByAdminToken(supabase, adminToken);
  if (!season) return null;

  const [{ data: teams, error: teamsError }, { data: claims, error: claimsError }] =
    await Promise.all([
      supabase.from("teams").select("*").eq("season_id", season.id).order("sort_index", { ascending: true }),
      supabase.from("claims").select("*").eq("season_id", season.id),
    ]);

  if (teamsError) throw teamsError;
  if (claimsError) throw claimsError;

  return { season, teams: (teams ?? []) as Team[], claims: (claims ?? []) as Claim[] };
}
