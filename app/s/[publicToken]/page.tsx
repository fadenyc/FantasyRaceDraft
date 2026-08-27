import { notFound } from "next/navigation";
import { getSeasonBundleByPublicToken } from "@/lib/db/queries";
import { SeasonView } from "@/components/public/SeasonView";

export const dynamic = "force-dynamic";

export default async function PublicSeasonPage({
  params,
}: {
  params: Promise<{ publicToken: string }>;
}) {
  const { publicToken } = await params;
  const bundle = await getSeasonBundleByPublicToken(publicToken);

  if (!bundle) notFound();

  return (
    <SeasonView
      publicToken={publicToken}
      initialSeason={bundle.season}
      initialTeams={bundle.teams}
      initialClaims={bundle.claims}
    />
  );
}
