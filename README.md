# Fantasy Race Draft

A live, fair, replayable draft-order lottery for a fantasy football league. The commissioner sets up a season, locks in a fairness commitment before the event, and everyone watches (and cheers on) an animated race that resolves into the season's draft order.

See `/Users/fa./.claude/plans/mellow-wondering-gadget.md` for the full design writeup (fairness mechanism, data model, architecture).

## Setup

1. **Create a Supabase project** (free tier) at [supabase.com](https://supabase.com).
2. **Run the migration**: open the SQL Editor in your Supabase project and run the contents of `supabase/migrations/0001_init.sql`.
3. **Confirm Realtime is enabled** for the project (it is by default on new projects) — the migration already adds `teams` and `claims` to the `supabase_realtime` publication.
4. **Copy env vars**: `cp .env.local.example .env.local` and fill in the three values from Project Settings → API in the Supabase dashboard (URL, anon key, service role key).
5. **Install and run**:
   ```bash
   npm install
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

## Testing

```bash
npm test
```

Covers the fairness commit/reveal/shuffle logic and the race animation math — the parts where a bug would actually be a fairness bug.

## Deploying

Push to GitHub and import the repo into [Vercel](https://vercel.com/new). Add the same three env vars from `.env.local` in the Vercel project settings. No other configuration needed — all routes that touch the database are marked `force-dynamic`, so nothing gets stale-cached.

## How it works

- **Commissioner** (`/new` → `/admin/[adminToken]`, a private link — never share it): enters team names, optionally sets a coordination date/time, locks the roster with "Lock Roster & Commit" (this publishes a SHA-256 fingerprint of a secret seed before anyone knows the outcome), then clicks "Start Race" at event time.
- **League members** (`/s/[publicToken]`, the link to share): pick their team from the list, watch the live race, can send cosmetic "cheer" pulses that never affect the outcome, and see the final draft order once the race finishes.
- **Fairness**: the draft order is a deterministic, seeded Fisher–Yates shuffle — anyone can recompute it from the revealed seed and confirm it matches. See the "How do I know this isn't rigged?" panel on the season page.
- **No-shows**: anyone visiting the link after the event sees an identical replay and the final results — nobody is penalized for missing the live moment.
