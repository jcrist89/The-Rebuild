-- reacher_messages already exists with RLS + policies applied directly in Supabase.
-- This only removes default table-level grants that every other product table in this
-- schema explicitly narrows (see 20260908040958_owner_managed_accounts.sql): anon had no
-- matching policy so it was already blocked in practice, and authenticated held DELETE/
-- TRUNCATE grants unused by any policy. RLS already enforced correct behavior either way —
-- this is defense in depth, not a behavior change for real requests.
revoke all on table public.reacher_messages from anon;
revoke all on table public.reacher_messages from authenticated;
grant select, insert, update on table public.reacher_messages to authenticated;
grant all on table public.reacher_messages to service_role;
