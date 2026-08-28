-- Commissioner-configurable race animation length (in seconds).
alter table seasons add column race_duration_seconds integer not null default 60
  check (race_duration_seconds between 15 and 300);

-- public_seasons has an explicit column list rather than `select *`, so it
-- needs to be recreated to expose the new column to the public-facing read
-- path. Postgres only allows appending new columns at the end of a view's
-- column list via CREATE OR REPLACE — hence race_duration_seconds going
-- after created_at rather than living next to its logically-related siblings.
create or replace view public_seasons as
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
    created_at,
    race_duration_seconds
  from seasons;
