-- Fantasy Race Draft — initial schema
-- Three tables (seasons, teams, claims) + a public-safe view over seasons.
-- Writes only ever happen server-side via the service role key; the anon
-- key (used by the browser) gets read-only SELECT on the public view,
-- teams, and claims — and nothing at all on the base `seasons` table, so
-- admin_token and the pre-reveal server_seed can never leak client-side.

create extension if not exists pgcrypto;

create table seasons (
  id                        uuid primary key default gen_random_uuid(),
  name                      text not null,
  public_token              text not null unique,
  admin_token               text not null unique,
  scheduled_at              timestamptz,
  status                    text not null default 'setup'
                              check (status in ('setup', 'committed', 'revealed', 'archived')),
  commitment_hash           text,
  commitment_published_at   timestamptz,
  server_seed               text,
  reveal_seed_uint32        bigint,
  final_order               jsonb,
  revealed_at               timestamptz,
  created_at                timestamptz not null default now()
);

create table teams (
  id            uuid primary key default gen_random_uuid(),
  season_id     uuid not null references seasons(id) on delete cascade,
  name          text not null,
  sort_index    int not null,
  created_at    timestamptz not null default now()
);

create table claims (
  id            uuid primary key default gen_random_uuid(),
  team_id       uuid not null unique references teams(id) on delete cascade,
  season_id     uuid not null references seasons(id) on delete cascade,
  client_token  text not null,
  claimed_at    timestamptz not null default now()
);

create index teams_season_id_idx on teams(season_id);
create index claims_season_id_idx on claims(season_id);
create index claims_client_token_idx on claims(client_token);

-- Public-safe view: every seasons column except admin_token (secret credential)
-- and server_seed pre-reveal (must stay hidden until the commissioner reveals it).
create view public_seasons as
  select
    id,
    name,
    public_token,
    scheduled_at,
    status,
    commitment_hash,
    commitment_published_at,
    case when status = 'revealed' then server_seed else null end as server_seed,
    reveal_seed_uint32,
    final_order,
    revealed_at,
    created_at
  from seasons;

-- `seasons` gets RLS enabled with zero policies: this blocks all anon/authenticated
-- access outright, regardless of any grant — the real guard for admin_token and
-- the pre-reveal server_seed. Only the service role (which bypasses RLS) can touch it.
alter table seasons enable row level security;

-- `teams` and `claims` are intentionally public read data (team names, who's
-- claimed what), so RLS is enabled with an explicit permissive SELECT policy —
-- writes stay blocked for anon/authenticated since no insert/update/delete
-- policy exists; only the service role can write.
alter table teams enable row level security;
alter table claims enable row level security;

create policy teams_public_read on teams for select to anon, authenticated using (true);
create policy claims_public_read on claims for select to anon, authenticated using (true);

grant select on public_seasons to anon, authenticated;
grant select on teams to anon, authenticated;
grant select on claims to anon, authenticated;

-- service_role bypasses RLS and already has full access by default in Supabase.

-- Enable Realtime postgres_changes for live claim-list updates.
alter publication supabase_realtime add table teams;
alter publication supabase_realtime add table claims;
