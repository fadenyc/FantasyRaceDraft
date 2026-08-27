import { NextRequest, NextResponse } from "next/server";
import { deriveRevealSeedUint32 } from "@/lib/fairness/commitment";
import { computeFinalOrder } from "@/lib/fairness/shuffle";
import { getSeasonByAdminToken } from "@/lib/db/admin";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { broadcastOnce } from "@/lib/supabase/realtime";

/**
 * Reveals the seed, derives the final draft order, and broadcasts the
 * race_start signal. This is the only place `final_order` is ever
 * computed and written — anyone can independently recompute it from the
 * revealed server_seed afterward to audit it.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ adminToken: string }> },
) {
  const { adminToken } = await params;
  const supabase = createServiceRoleClient();
  const season = await getSeasonByAdminToken(supabase, adminToken);
  if (!season) return NextResponse.json({ error: "Not found." }, { status: 404 });

  if (season.status !== "committed" || !season.server_seed) {
    return NextResponse.json(
      { error: "Season must be committed before starting the race." },
      { status: 409 },
    );
  }

  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("id, sort_index")
    .eq("season_id", season.id);

  if (teamsError || !teams || teams.length === 0) {
    return NextResponse.json({ error: "Failed to load teams." }, { status: 500 });
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

  if (error) {
    return NextResponse.json({ error: "Failed to reveal." }, { status: 500 });
  }

  await broadcastOnce(supabase, `season:${season.public_token}`, "race_start", {
    revealSeedUint32,
    finalOrder,
    raceStartAt: revealedAt,
  });

  return NextResponse.json({ revealSeedUint32, finalOrder, revealedAt });
}
