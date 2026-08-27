-- Waiting-room chat. Same pattern as claims: anon gets read-only SELECT,
-- writes only ever happen server-side via the service role key (so message
-- length/content can be validated and rate-limited before hitting the DB).

create table chat_messages (
  id            uuid primary key default gen_random_uuid(),
  season_id     uuid not null references seasons(id) on delete cascade,
  client_token  text not null,
  -- Snapshot of the sender's claimed team at send time (nullable — chatting
  -- doesn't require having picked a team). Keeping this as a direct FK
  -- rather than re-deriving it from `claims` at read time means a message
  -- keeps showing the same avatar even if the sender later releases or
  -- changes their claim.
  team_id       uuid references teams(id) on delete set null,
  body          text not null check (char_length(body) between 1 and 240),
  created_at    timestamptz not null default now()
);

create index chat_messages_season_id_idx on chat_messages(season_id, created_at);
create index chat_messages_client_token_idx on chat_messages(client_token);

alter table chat_messages enable row level security;

create policy chat_messages_public_read on chat_messages for select to anon, authenticated using (true);

grant select on chat_messages to anon, authenticated;

-- service_role bypasses RLS and already has full access by default in Supabase.

alter publication supabase_realtime add table chat_messages;
