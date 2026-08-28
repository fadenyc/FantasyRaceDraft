import { NextRequest, NextResponse } from "next/server";
import { getSeasonByIdForOwner } from "@/lib/db/admin";
import { revealAndStartRace } from "@/lib/db/race";
import { createServiceRoleClient, createSessionClient } from "@/lib/supabase/server";

/** Owner-session equivalent of /api/admin/[adminToken]/start. */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ seasonId: string }> },
) {
  const { seasonId } = await params;

  const sessionClient = await createSessionClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const supabase = createServiceRoleClient();
  const season = await getSeasonByIdForOwner(supabase, seasonId, user.id);
  if (!season) return NextResponse.json({ error: "Not found." }, { status: 404 });

  try {
    const result = await revealAndStartRace(supabase, season);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to start the race.";
    const status = message.includes("must be committed") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
