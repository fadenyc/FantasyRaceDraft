import { notFound, redirect } from "next/navigation";
import { getOwnedSeasonById } from "@/lib/db/admin";
import { createSessionClient } from "@/lib/supabase/server";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { getOrigin } from "@/lib/server/origin";
import { generateQrCodeDataUrl } from "@/lib/server/qrcode";

export const dynamic = "force-dynamic";

export default async function OwnedSeasonAdminPage({
  params,
}: {
  params: Promise<{ seasonId: string }>;
}) {
  const { seasonId } = await params;

  const sessionClient = await createSessionClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();
  if (!user) redirect(`/login?next=/dashboard/${seasonId}`);

  const bundle = await getOwnedSeasonById(seasonId, user.id);
  if (!bundle) notFound();

  const { season, teams, claims } = bundle;
  const origin = await getOrigin();
  const publicUrl = `${origin}/s/${season.public_token}`;
  const qrCodeDataUrl = await generateQrCodeDataUrl(publicUrl);

  return (
    <AdminDashboard
      apiBase={`/api/dashboard/${seasonId}`}
      season={{
        id: season.id,
        name: season.name,
        public_token: season.public_token,
        scheduled_at: season.scheduled_at,
        status: season.status,
        commitment_hash: season.commitment_hash,
        commitment_published_at: season.commitment_published_at,
        server_seed: season.status === "revealed" ? season.server_seed : null,
        reveal_seed_uint32: season.reveal_seed_uint32,
        final_order: season.final_order,
        revealed_at: season.revealed_at,
        race_duration_seconds: season.race_duration_seconds,
        snake_draft_rounds: season.snake_draft_rounds,
        created_at: season.created_at,
      }}
      teams={teams}
      claims={claims}
      publicUrl={publicUrl}
      adminUrl={null}
      qrCodeDataUrl={qrCodeDataUrl}
    />
  );
}
