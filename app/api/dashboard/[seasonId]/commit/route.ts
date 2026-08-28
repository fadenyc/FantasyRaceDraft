import { NextRequest, NextResponse } from "next/server";
import { computeCommitmentHash, generateServerSeed } from "@/lib/fairness/commitment";
import { getSeasonByIdForOwner } from "@/lib/db/admin";
import { createServiceRoleClient, createSessionClient } from "@/lib/supabase/server";

/** Owner-session equivalent of /api/admin/[adminToken]/commit. */
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
