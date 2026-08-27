import Image from "next/image";
import Link from "next/link";
import { listPublicSeasons } from "@/lib/db/queries";
import stadiumFootball from "@/public/images/stadium-football.png";

export const dynamic = "force-dynamic";

export default async function Home() {
  const seasons = await listPublicSeasons();

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

        <div className="flex flex-col gap-3">
          <Link
            href="/new"
            className="group flex items-center gap-2 font-display text-2xl tracking-wide text-chalk hover:text-endzone-400"
          >
            Start a Season
            <span className="text-field-400 transition-transform group-hover:translate-x-1">›</span>
          </Link>

          {seasons.length === 0 ? (
            <p className="text-sm text-chalk-faint">
              No seasons yet — create one to get a link you can share with your league.
            </p>
          ) : (
            <ul className="flex flex-col">
              {seasons.map((season) => (
                <li key={season.id} className="border-b border-turf-700/60">
                  <Link
                    href={`/s/${season.public_token}`}
                    className="flex items-center justify-between gap-3 py-3 text-chalk hover:text-field-400"
                  >
                    <span className="font-medium">{season.name}</span>
                    <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-field-400">
                      {season.status}
                      <span className="text-sm">›</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
