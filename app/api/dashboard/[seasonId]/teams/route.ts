import { NextRequest, NextResponse } from "next/server";
import { getSeasonByIdForOwner } from "@/lib/db/admin";
import { createServiceRoleClient, createSessionClient } from "@/lib/supabase/server";

/**
 * Owner-session equivalent of /api/admin/[adminToken]/teams — same
 * behavior, authorized by the signed-in user owning the season instead of
 * a token in the URL. Renames existing teams; only allowed pre-commit.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ seasonId: string }> },
) {
  const { seasonId } = await params;
  const body = await request.json().catch(() => null);

  if (!body || !Array.isArray(body.teams)) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const sessionClient = await createSessionClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const supabase = createServiceRoleClient();
  const season = await getSeasonByIdForOwner(supabase, seasonId, user.id);
  if (!season) return NextResponse.json({ error: "Not found." }, { status: 404 });

  if (season.status !== "setup") {
    return NextResponse.json(
      { error: "Roster is locked — it can only be edited before committing." },
      { status: 409 },
    );
  }

  for (const team of body.teams) {
    if (typeof team.id !== "string" || typeof team.name !== "string" || !team.name.trim()) {
      return NextResponse.json({ error: "Each team needs an id and a non-empty name." }, { status: 400 });
    }
  }

  for (const team of body.teams) {
    const { error } = await supabase
      .from("teams")
      .update({ name: team.name.trim() })
      .eq("id", team.id)
      .eq("season_id", season.id);
    if (error) {
      return NextResponse.json({ error: "Failed to update team names." }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
