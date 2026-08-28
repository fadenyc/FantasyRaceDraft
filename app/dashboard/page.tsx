import Link from "next/link";
import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { listSeasonsByOwner } from "@/lib/db/admin";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { SeasonList } from "@/components/dashboard/SeasonList";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    title: "Create a season",
    body: "Name it, add your league's team names, and optionally set a date for the event.",
  },
  {
    title: "Share the link",
    body: "You get one link for your whole league to join and see the draft order lottery live.",
  },
  {
    title: "Everyone claims their team",
    body: "Each manager picks their team from the roster so it's clear who's who during the race.",
  },
  {
    title: "Watch the race decide it",
    body: "At the scheduled time (or whenever you hit start), a fair, provably-random race sets the draft order — no one can rig it, and you can verify it after.",
  },
];

export default async function DashboardPage() {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/dashboard");

  const seasons = await listSeasonsByOwner(user.id);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-8 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl tracking-wide text-chalk">My Seasons</h1>
          <p className="text-base text-chalk-muted">Signed in as {user.email}</p>
        </div>
        <SignOutButton />
      </div>

      <Link
        href="/new"
        className="w-fit rounded-full bg-endzone-500 px-6 py-3 font-display text-lg tracking-wide text-chalk shadow-[0_0_30px_-8px_var(--color-endzone-500)] hover:bg-endzone-600"
      >
        Start a Season
      </Link>

      <SeasonList initialSeasons={seasons} />

      <div className="flex flex-col gap-4 rounded-xl border border-turf-700 bg-turf-800/50 p-5">
        <h2 className="font-display text-2xl tracking-wide text-chalk">How it works</h2>
        <ol className="flex flex-col gap-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-endzone-500 font-display text-base text-chalk">
                {index + 1}
              </span>
              <div>
                <div className="text-lg font-medium text-chalk">{step.title}</div>
                <p className="text-base text-chalk-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
