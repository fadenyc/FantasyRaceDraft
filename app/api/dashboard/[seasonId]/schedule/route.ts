import { NextRequest, NextResponse } from "next/server";
import { getSeasonByIdForOwner } from "@/lib/db/admin";
import { createServiceRoleClient, createSessionClient } from "@/lib/supabase/server";

const MIN_DURATION_SECONDS = 15;
const MAX_DURATION_SECONDS = 300;
const MIN_ROUNDS = 1;
const MAX_ROUNDS = 30;

/** Owner-session equivalent of /api/admin/[adminToken]/schedule. */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ seasonId: string }> },
) {
  const { seasonId } = await params;
  const body = await request.json().catch(() => null);

  if (!body || (body.scheduledAt !== null && typeof body.scheduledAt !== "string")) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (
    body.raceDurationSeconds !== undefined &&
    (typeof body.raceDurationSeconds !== "number" ||
      body.raceDurationSeconds < MIN_DURATION_SECONDS ||
      body.raceDurationSeconds > MAX_DURATION_SECONDS)
  ) {
    return NextResponse.json(
      { error: `Race length must be between ${MIN_DURATION_SECONDS} and ${MAX_DURATION_SECONDS} seconds.` },
      { status: 400 },
    );
  }

  if (
    body.snakeDraftRounds !== undefined &&
    body.snakeDraftRounds !== null &&
    (typeof body.snakeDraftRounds !== "number" ||
      body.snakeDraftRounds < MIN_ROUNDS ||
      body.snakeDraftRounds > MAX_ROUNDS)
  ) {
    return NextResponse.json(
      { error: `Snake board rounds must be between ${MIN_ROUNDS} and ${MAX_ROUNDS}.` },
      { status: 400 },
    );
  }

  const sessionClient = await createSessionClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const supabase = createServiceRoleClient();
  const season = await getSeasonByIdForOwner(supabase, seasonId, user.id);
  if (!season) return NextResponse.json({ error: "Not found." }, { status: 404 });

  if (season.status === "revealed" || season.status === "archived") {
    return NextResponse.json({ error: "This season has already concluded." }, { status: 409 });
  }

  const { error } = await supabase
    .from("seasons")
    .update({
      scheduled_at: body.scheduledAt,
      ...(body.raceDurationSeconds !== undefined ? { race_duration_seconds: body.raceDurationSeconds } : {}),
      ...(body.snakeDraftRounds !== undefined ? { snake_draft_rounds: body.snakeDraftRounds } : {}),
    })
    .eq("id", season.id);

  if (error) {
    return NextResponse.json({ error: "Failed to update schedule." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
