import { NextRequest, NextResponse } from "next/server";
import { getSeasonByIdForOwner } from "@/lib/db/admin";
import { createServiceRoleClient, createSessionClient } from "@/lib/supabase/server";

/** Deletes an owned season — cascades to its teams, claims, and chat messages via FK constraints. */
export async function DELETE(
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

  const { error } = await supabase.from("seasons").delete().eq("id", season.id);
  if (error) return NextResponse.json({ error: "Failed to delete season." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
