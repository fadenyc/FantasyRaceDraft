import { NextRequest, NextResponse } from "next/server";
import { GRACE_PERIOD_MINUTES } from "@/lib/constants";
import { revealAndStartRace } from "@/lib/db/race";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { Season } from "@/lib/db/types";

/**
 * Starts the race once its scheduled time + grace period has passed —
 * callable by anyone, no admin credentials needed. Safe to expose publicly
 * because it's strictly time-gated (can't fire early) and outcome-preserving
 * (the shuffle was already locked in at commit time; this only reveals it).
 * Polled from the public waiting room so the race starts on time even if
 * the commissioner isn't around to click the button — whoever's page is
 * open when the clock runs out triggers it for everyone.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ publicToken: string }> },
) {
  const { publicToken } = await params;
  const supabase = createServiceRoleClient();

  const { data: season } = await supabase
    .from("seasons")
    .select("*")
    .eq("public_token", publicToken)
    .maybeSingle();

  if (!season) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const s = season as Season;
  if (s.status !== "committed" || !s.scheduled_at) {
    return NextResponse.json({ error: "Not ready to auto-start." }, { status: 409 });
  }

  const graceEndMs = new Date(s.scheduled_at).getTime() + GRACE_PERIOD_MINUTES * 60_000;
  if (Date.now() < graceEndMs) {
    return NextResponse.json({ error: "Grace period hasn't elapsed yet." }, { status: 409 });
  }

  try {
    const result = await revealAndStartRace(supabase, s);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to start the race.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
