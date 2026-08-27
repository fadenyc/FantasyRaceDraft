import { notFound } from "next/navigation";
import { getAdminBundleByAdminToken } from "@/lib/db/admin";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { getOrigin } from "@/lib/server/origin";
import { generateQrCodeDataUrl } from "@/lib/server/qrcode";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  params,
}: {
  params: Promise<{ adminToken: string }>;
}) {
  const { adminToken } = await params;
  const bundle = await getAdminBundleByAdminToken(adminToken);

  if (!bundle) notFound();

  const { season, teams, claims } = bundle;
  const origin = await getOrigin();
  const publicUrl = `${origin}/s/${season.public_token}`;
  const adminUrl = `${origin}/admin/${adminToken}`;
  const qrCodeDataUrl = await generateQrCodeDataUrl(publicUrl);

  return (
    <AdminDashboard
      adminToken={adminToken}
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
        created_at: season.created_at,
      }}
      teams={teams}
      claims={claims}
      publicUrl={publicUrl}
      adminUrl={adminUrl}
      qrCodeDataUrl={qrCodeDataUrl}
    />
  );
}
