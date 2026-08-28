-- Commissioner-optional full snake draft board. Null/0 = not shown (default);
-- a positive value is how many rounds to expand the round-1 order into.
alter table seasons add column snake_draft_rounds integer
  check (snake_draft_rounds is null or snake_draft_rounds between 1 and 30);

-- public_seasons has an explicit column list rather than `select *`; new
-- columns can only be appended at the end via CREATE OR REPLACE VIEW.
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
    race_duration_seconds,
    snake_draft_rounds
  from seasons;
