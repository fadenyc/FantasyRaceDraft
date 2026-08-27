import { NextRequest, NextResponse } from "next/server";
import { getSeasonByAdminToken } from "@/lib/db/admin";
import { createServiceRoleClient } from "@/lib/supabase/server";

/** Renames existing teams. Only allowed pre-commit — the roster is locked once fairness is committed to. */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ adminToken: string }> },
) {
  const { adminToken } = await params;
  const body = await request.json().catch(() => null);

  if (!body || !Array.isArray(body.teams)) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const season = await getSeasonByAdminToken(supabase, adminToken);
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
