-- Multi-tenant accounts. Additive only — existing (unowned) seasons keep
-- working exactly as they do today via their admin_token link. Seasons
-- created going forward by a signed-in commissioner get owner_user_id set,
-- and are managed via the auth-gated dashboard instead of an admin link.

alter table seasons add column owner_user_id uuid references auth.users(id) on delete set null;
create index seasons_owner_user_id_idx on seasons(owner_user_id);

-- No RLS/grant changes needed: all access to `seasons` still goes through
-- server-side routes using the service-role key, which now additionally
-- checks owner_user_id against the signed-in user for the new routes.
