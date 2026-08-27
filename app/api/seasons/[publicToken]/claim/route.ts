import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

async function getSeasonId(
  supabase: ReturnType<typeof createServiceRoleClient>,
  publicToken: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("seasons")
    .select("id")
    .eq("public_token", publicToken)
    .maybeSingle();
  return data?.id ?? null;
}

/** Looks up which team (if any) a given client_token has claimed in this season. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ publicToken: string }> },
) {
  const { publicToken } = await params;
  const clientToken = request.nextUrl.searchParams.get("clientToken");

  if (!clientToken) {
    return NextResponse.json({ error: "Missing clientToken." }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const seasonId = await getSeasonId(supabase, publicToken);
  if (!seasonId) return NextResponse.json({ error: "Season not found." }, { status: 404 });

  const { data: claim } = await supabase
    .from("claims")
    .select("team_id")
    .eq("season_id", seasonId)
    .eq("client_token", clientToken)
    .maybeSingle();

  return NextResponse.json({ teamId: claim?.team_id ?? null });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ publicToken: string }> },
) {
  const { publicToken } = await params;
  const body = await request.json().catch(() => null);

  if (!body || typeof body.teamId !== "string" || typeof body.clientToken !== "string") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const seasonId = await getSeasonId(supabase, publicToken);
  if (!seasonId) return NextResponse.json({ error: "Season not found." }, { status: 404 });

  const { data: team } = await supabase
    .from("teams")
    .select("id")
    .eq("id", body.teamId)
    .eq("season_id", seasonId)
    .maybeSingle();

  if (!team) {
    return NextResponse.json({ error: "Team not found in this season." }, { status: 404 });
  }

  const { error } = await supabase.from("claims").insert({
    team_id: body.teamId,
    season_id: seasonId,
    client_token: body.clientToken,
  });

  if (error) {
    // Unique violation on team_id — the DB constraint is the real double-claim guard.
    if (error.code === "23505") {
      return NextResponse.json({ error: "That team has already been claimed." }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to claim team." }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ publicToken: string }> },
) {
  const { publicToken } = await params;
  const body = await request.json().catch(() => null);

  if (!body || typeof body.teamId !== "string" || typeof body.clientToken !== "string") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const seasonId = await getSeasonId(supabase, publicToken);
  if (!seasonId) return NextResponse.json({ error: "Season not found." }, { status: 404 });

  // Only the original claimant's browser (matching client_token) can release a claim.
  const { error, count } = await supabase
    .from("claims")
    .delete({ count: "exact" })
    .eq("team_id", body.teamId)
    .eq("season_id", seasonId)
    .eq("client_token", body.clientToken);

  if (error) {
    return NextResponse.json({ error: "Failed to release claim." }, { status: 500 });
  }

  if (!count) {
    return NextResponse.json({ error: "No matching claim to release." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
