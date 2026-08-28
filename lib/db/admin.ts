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

/**
 * Looks up a season by id, scoped to a specific owner. Returns null both
 * when the season doesn't exist AND when it belongs to someone else (or
 * has no owner, e.g. a legacy admin-link season) — callers should 404
 * either way. Used by the owner-gated mutation routes (teams/schedule/
 * commit/start under /api/dashboard), which only need the season row
 * itself, not the full teams+claims bundle.
 */
export async function getSeasonByIdForOwner(
  supabase: SupabaseClient,
  seasonId: string,
  userId: string,
): Promise<Season | null> {
  const { data, error } = await supabase
    .from("seasons")
    .select("*")
    .eq("id", seasonId)
    .eq("owner_user_id", userId)
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

  return loadAdminBundle(supabase, season);
}

/** Every season owned by a signed-in commissioner, newest first — the "My Seasons" dashboard list. */
export async function listSeasonsByOwner(userId: string): Promise<Season[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("seasons")
    .select("*")
    .eq("owner_user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Season[];
}

export interface SeasonWithTeamNames {
  id: string;
  name: string;
  teamNames: string[];
}

/**
 * Every season owned by a commissioner, with its team names attached — used
 * to power "reuse a previous season's roster" on the new-season form. One
 * batched teams query (not N+1) even though it's grouped back per season.
 */
export async function listSeasonsWithTeamNamesByOwner(userId: string): Promise<SeasonWithTeamNames[]> {
  const seasons = await listSeasonsByOwner(userId);
  if (seasons.length === 0) return [];

  const supabase = createServiceRoleClient();
  const { data: teams, error } = await supabase
    .from("teams")
    .select("season_id, name, sort_index")
    .in("season_id", seasons.map((s) => s.id))
    .order("sort_index", { ascending: true });

  if (error) throw error;

  const teamNamesBySeasonId = new Map<string, string[]>();
  for (const team of teams ?? []) {
    const list = teamNamesBySeasonId.get(team.season_id) ?? [];
    list.push(team.name);
    teamNamesBySeasonId.set(team.season_id, list);
  }

  return seasons.map((season) => ({
    id: season.id,
    name: season.name,
    teamNames: teamNamesBySeasonId.get(season.id) ?? [],
  }));
}

/**
 * Loads a season by id for the owner-gated dashboard route. Returns null
 * both when the season doesn't exist AND when it exists but belongs to
 * someone else (or has no owner at all, e.g. a legacy admin-link season) —
 * callers should 404 either way, not leak which case it was.
 */
export async function getOwnedSeasonById(seasonId: string, userId: string): Promise<AdminBundle | null> {
  const supabase = createServiceRoleClient();
  const { data: season, error } = await supabase
    .from("seasons")
    .select("*")
    .eq("id", seasonId)
    .eq("owner_user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!season) return null;

  return loadAdminBundle(supabase, season as Season);
}

async function loadAdminBundle(supabase: SupabaseClient, season: Season): Promise<AdminBundle> {
  const [{ data: teams, error: teamsError }, { data: claims, error: claimsError }] =
    await Promise.all([
      supabase.from("teams").select("*").eq("season_id", season.id).order("sort_index", { ascending: true }),
      supabase.from("claims").select("*").eq("season_id", season.id),
    ]);

  if (teamsError) throw teamsError;
  if (claimsError) throw claimsError;

  return { season, teams: (teams ?? []) as Team[], claims: (claims ?? []) as Claim[] };
}
