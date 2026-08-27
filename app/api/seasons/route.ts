import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { generateAdminToken, generatePublicToken } from "@/lib/tokens";

const MIN_TEAMS = 2;
const MAX_TEAMS = 24;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (
    !body ||
    typeof body.name !== "string" ||
    !body.name.trim() ||
    !Array.isArray(body.teamNames)
  ) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const teamNames: string[] = body.teamNames
    .map((n: unknown) => (typeof n === "string" ? n.trim() : ""))
    .filter((n: string) => n.length > 0);

  if (teamNames.length < MIN_TEAMS || teamNames.length > MAX_TEAMS) {
    return NextResponse.json(
      { error: `Provide between ${MIN_TEAMS} and ${MAX_TEAMS} team names.` },
      { status: 400 },
    );
  }

  const scheduledAt =
    typeof body.scheduledAt === "string" && body.scheduledAt ? body.scheduledAt : null;

  const supabase = createServiceRoleClient();
  const publicToken = generatePublicToken();
  const adminToken = generateAdminToken();

  const { data: season, error: seasonError } = await supabase
    .from("seasons")
    .insert({
      name: body.name.trim(),
      public_token: publicToken,
      admin_token: adminToken,
      scheduled_at: scheduledAt,
      status: "setup",
    })
    .select()
    .single();

  if (seasonError || !season) {
    return NextResponse.json({ error: "Failed to create season." }, { status: 500 });
  }

  const { error: teamsError } = await supabase.from("teams").insert(
    teamNames.map((name, index) => ({
      season_id: season.id,
      name,
      sort_index: index,
    })),
  );

  if (teamsError) {
    // Roll back the orphaned season row rather than leaving a teamless season around.
    await supabase.from("seasons").delete().eq("id", season.id);
    return NextResponse.json({ error: "Failed to create teams." }, { status: 500 });
  }

  return NextResponse.json({ publicToken, adminToken }, { status: 201 });
}
