import Link from "next/link";
import { redirect } from "next/navigation";
import { NewSeasonForm } from "@/components/new/NewSeasonForm";
import { createSessionClient } from "@/lib/supabase/server";
import { listSeasonsWithTeamNamesByOwner } from "@/lib/db/admin";

export const dynamic = "force-dynamic";

export default async function NewSeasonPage() {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/new");

  const previousSeasons = await listSeasonsWithTeamNamesByOwner(user.id);

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-2xl flex-col gap-6 p-6">
      <h1 className="font-display text-4xl tracking-wide text-chalk">New Season</h1>
      <p className="text-sm text-chalk-muted">
        You&apos;ll get a link to share with your league. You manage the season from your{" "}
        <Link href="/dashboard" className="underline hover:text-chalk">
          dashboard
        </Link>{" "}
        — no separate admin link to keep track of.
      </p>
      <NewSeasonForm previousSeasons={previousSeasons} />
    </div>
  );
}
