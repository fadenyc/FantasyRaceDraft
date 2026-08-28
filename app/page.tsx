import Image from "next/image";
import Link from "next/link";
import { createSessionClient } from "@/lib/supabase/server";
import stadiumFootball from "@/public/images/stadium-football.png";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="relative min-h-screen overflow-hidden">
      <Image
        src={stadiumFootball}
        alt=""
        fill
        priority
        placeholder="blur"
        className="object-cover object-right"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-turf-950 via-turf-950/85 to-turf-950/20" />

      <div className="relative mx-auto flex w-full min-h-screen min-w-0 max-w-3xl flex-col justify-center gap-10 p-6">
        <div className="flex flex-col items-start gap-3">
          <span className="text-4xl">🏈</span>
          <h1 className="font-display text-5xl leading-none tracking-wide text-chalk">
            Fantasy Race <span className="text-endzone-500">Draft</span>
          </h1>
          <p className="max-w-md text-chalk-muted">
            A live, fair, no-excuses way to settle your league&apos;s draft order — race for it.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {user ? (
            <>
              <Link
                href="/dashboard"
                className="rounded-full bg-endzone-500 px-6 py-3 font-display text-lg tracking-wide text-chalk shadow-[0_0_30px_-8px_var(--color-endzone-500)] hover:bg-endzone-600"
              >
                My Seasons
              </Link>
              <Link href="/new" className="font-display text-lg tracking-wide text-chalk-muted hover:text-chalk">
                Start a new one →
              </Link>
            </>
          ) : (
            <Link
              href="/login?next=/dashboard"
              className="rounded-full bg-endzone-500 px-6 py-3 font-display text-lg tracking-wide text-chalk shadow-[0_0_30px_-8px_var(--color-endzone-500)] hover:bg-endzone-600"
            >
              Sign In to Start a Season
            </Link>
          )}
        </div>

        <p className="max-w-md text-xs text-chalk-faint">
          Already have a season link from before accounts existed? It still works exactly as before —
          nothing to sign in for.
        </p>
      </div>
    </div>
  );
}
