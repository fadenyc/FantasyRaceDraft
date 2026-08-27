import { NextRequest, NextResponse } from "next/server";
import { getSeasonByAdminToken } from "@/lib/db/admin";
import { createServiceRoleClient } from "@/lib/supabase/server";

/** Updates the coordination timestamp shown to the league. Purely informational — doesn't gate "Start Race". */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ adminToken: string }> },
) {
  const { adminToken } = await params;
  const body = await request.json().catch(() => null);

  if (!body || (body.scheduledAt !== null && typeof body.scheduledAt !== "string")) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const season = await getSeasonByAdminToken(supabase, adminToken);
  if (!season) return NextResponse.json({ error: "Not found." }, { status: 404 });

  if (season.status === "revealed" || season.status === "archived") {
    return NextResponse.json({ error: "This season has already concluded." }, { status: 409 });
  }

  const { error } = await supabase
    .from("seasons")
    .update({ scheduled_at: body.scheduledAt })
    .eq("id", season.id);

  if (error) {
    return NextResponse.json({ error: "Failed to update schedule." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
