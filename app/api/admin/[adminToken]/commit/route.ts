import { NextRequest, NextResponse } from "next/server";
import { computeCommitmentHash, generateServerSeed } from "@/lib/fairness/commitment";
import { getSeasonByAdminToken } from "@/lib/db/admin";
import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Locks the roster and publishes the fairness commitment: generates the
 * secret server_seed, publishes only its sha256 hash, and freezes team
 * names from further edits. The seed itself stays hidden (server_seed is
 * only exposed publicly once status flips to "revealed" — see the
 * public_seasons view).
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ adminToken: string }> },
) {
  const { adminToken } = await params;
  const supabase = createServiceRoleClient();
  const season = await getSeasonByAdminToken(supabase, adminToken);
  if (!season) return NextResponse.json({ error: "Not found." }, { status: 404 });

  if (season.status !== "setup") {
    return NextResponse.json({ error: "This season has already been committed." }, { status: 409 });
  }

  const serverSeed = generateServerSeed();
  const commitmentHash = await computeCommitmentHash(serverSeed);
  const commitmentPublishedAt = new Date().toISOString();

  const { error } = await supabase
    .from("seasons")
    .update({
      server_seed: serverSeed,
      commitment_hash: commitmentHash,
      commitment_published_at: commitmentPublishedAt,
      status: "committed",
    })
    .eq("id", season.id);

  if (error) {
    return NextResponse.json({ error: "Failed to commit." }, { status: 500 });
  }

  return NextResponse.json({ commitmentHash, commitmentPublishedAt });
}
