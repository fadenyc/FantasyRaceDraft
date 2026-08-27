import "server-only";
import { createServiceRoleClient } from "../supabase/server";
import type { ChatMessage, Claim, PublicSeason, Team } from "./types";

const CHAT_HISTORY_LIMIT = 100;

/**
 * All public-facing reads go through the `public_seasons` view — even
 * here, server-side, with the service-role client — so the shape
 * returned can never include admin_token or the pre-reveal server_seed,
 * regardless of how this data later gets passed into a client component.
 */

export async function listPublicSeasons(): Promise<PublicSeason[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("public_seasons")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as PublicSeason[];
}

export interface SeasonBundle {
  season: PublicSeason;
  teams: Team[];
  claims: Claim[];
}

export async function getSeasonBundleByPublicToken(
  publicToken: string,
): Promise<SeasonBundle | null> {
  const supabase = createServiceRoleClient();

  const { data: season, error: seasonError } = await supabase
    .from("public_seasons")
    .select("*")
    .eq("public_token", publicToken)
    .maybeSingle();

  if (seasonError) throw seasonError;
  if (!season) return null;

  const [{ data: teams, error: teamsError }, { data: claims, error: claimsError }] =
    await Promise.all([
      supabase
        .from("teams")
        .select("*")
        .eq("season_id", season.id)
        .order("sort_index", { ascending: true }),
      supabase.from("claims").select("*").eq("season_id", season.id),
    ]);

  if (teamsError) throw teamsError;
  if (claimsError) throw claimsError;

  return {
    season: season as PublicSeason,
    teams: (teams ?? []) as Team[],
    claims: (claims ?? []) as Claim[],
  };
}

/** Most recent chat messages for a season, oldest first (ready to render top-to-bottom). */
export async function getChatMessages(seasonId: string): Promise<ChatMessage[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("season_id", seasonId)
    .order("created_at", { ascending: false })
    .limit(CHAT_HISTORY_LIMIT);

  if (error) throw error;
  return ((data ?? []) as ChatMessage[]).reverse();
}
