import { notFound } from "next/navigation";
import { getChatMessages, getSeasonBundleByPublicToken } from "@/lib/db/queries";
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

  const initialMessages = await getChatMessages(bundle.season.id);

  return (
    <SeasonView
      publicToken={publicToken}
      initialSeason={bundle.season}
      initialTeams={bundle.teams}
      initialClaims={bundle.claims}
      initialMessages={initialMessages}
    />
  );
}
