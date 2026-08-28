import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { deriveRevealSeedUint32 } from "../fairness/commitment";
import { computeFinalOrder } from "../fairness/shuffle";
import { broadcastOnce } from "../supabase/realtime";
import type { Season } from "./types";

export interface RevealResult {
  revealSeedUint32: number;
  finalOrder: string[];
  revealedAt: string;
}

/**
 * Reveals the seed, derives the final draft order, and broadcasts
 * race_start. This is the only place `final_order` is ever computed and
 * written — anyone can independently recompute it from the revealed
 * server_seed afterward to audit it. Shared by the token-based admin route,
 * the owner-session dashboard route, and the public grace-period auto-start
 * route — every path that can ever start a race funnels through here.
 */
export async function revealAndStartRace(
  supabase: SupabaseClient,
  season: Pick<Season, "id" | "public_token" | "status" | "server_seed">,
): Promise<RevealResult> {
  if (season.status !== "committed" || !season.server_seed) {
    throw new Error("Season must be committed before starting the race.");
  }

  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("id, sort_index")
    .eq("season_id", season.id);

  if (teamsError || !teams || teams.length === 0) {
    throw new Error("Failed to load teams.");
  }

  const revealSeedUint32 = await deriveRevealSeedUint32(season.server_seed);
  const finalOrder = computeFinalOrder(teams, revealSeedUint32);
  const revealedAt = new Date().toISOString();

  const { error } = await supabase
    .from("seasons")
    .update({
      reveal_seed_uint32: revealSeedUint32,
      final_order: finalOrder,
      revealed_at: revealedAt,
      status: "revealed",
    })
    .eq("id", season.id);

  if (error) throw new Error("Failed to reveal.");

  await broadcastOnce(supabase, `season:${season.public_token}`, "race_start", {
    revealSeedUint32,
    finalOrder,
    raceStartAt: revealedAt,
  });

  return { revealSeedUint32, finalOrder, revealedAt };
}
