import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

const MAX_MESSAGE_LENGTH = 240;
const RATE_LIMIT_MS = 2000;

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ publicToken: string }> },
) {
  const { publicToken } = await params;
  const body = await request.json().catch(() => null);

  if (!body || typeof body.clientToken !== "string" || typeof body.body !== "string") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const text = body.body.trim();
  if (!text || text.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `Message must be 1-${MAX_MESSAGE_LENGTH} characters.` },
      { status: 400 },
    );
  }

  const supabase = createServiceRoleClient();
  const seasonId = await getSeasonId(supabase, publicToken);
  if (!seasonId) return NextResponse.json({ error: "Season not found." }, { status: 404 });

  // Lightweight spam guard: one message per client every couple of seconds.
  const { data: recent } = await supabase
    .from("chat_messages")
    .select("created_at")
    .eq("season_id", seasonId)
    .eq("client_token", body.clientToken)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recent && Date.now() - new Date(recent.created_at).getTime() < RATE_LIMIT_MS) {
    return NextResponse.json({ error: "Slow down a little." }, { status: 429 });
  }

  // Snapshot whichever team (if any) this browser currently has claimed —
  // that's the avatar the message will always show, even if the claim
  // changes later.
  const { data: claim } = await supabase
    .from("claims")
    .select("team_id")
    .eq("season_id", seasonId)
    .eq("client_token", body.clientToken)
    .maybeSingle();

  const { data: message, error } = await supabase
    .from("chat_messages")
    .insert({
      season_id: seasonId,
      client_token: body.clientToken,
      team_id: claim?.team_id ?? null,
      body: text,
    })
    .select()
    .single();

  if (error || !message) {
    return NextResponse.json({ error: "Failed to send message." }, { status: 500 });
  }

  return NextResponse.json({ message }, { status: 201 });
}
