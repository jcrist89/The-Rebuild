-- Documents public.reacher_messages as it already exists in the live database (added directly
-- in Supabase on 2026-09-19). Reconstructed here, idempotently, so a fresh clone of this repo
-- can reproduce the schema the app now depends on for coach <-> client messaging.

create table if not exists public.reacher_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  author text not null check (author = any (array['admin'::text, 'buyer'::text])),
  message text not null,
  read boolean not null default false,
  product_code text not null default 'REACHER_BUILD'::text,
  created_at timestamptz not null default now()
);

create index if not exists reacher_messages_user_id_created_at_idx
  on public.reacher_messages (user_id, created_at);

create index if not exists reacher_messages_unread_idx
  on public.reacher_messages (user_id)
  where read = false;

alter table public.reacher_messages enable row level security;

drop policy if exists reacher_messages_select on public.reacher_messages;
create policy reacher_messages_select
on public.reacher_messages for select
to authenticated
using (
  private.is_reacher_admin()
  or (user_id = (select auth.uid()) and (select private.has_reacher_access()))
);

drop policy if exists reacher_messages_insert on public.reacher_messages;
create policy reacher_messages_insert
on public.reacher_messages for insert
to authenticated
with check (
  private.is_reacher_admin()
  or (user_id = (select auth.uid()) and (select private.has_reacher_access()))
);

drop policy if exists reacher_messages_update on public.reacher_messages;
create policy reacher_messages_update
on public.reacher_messages for update
to authenticated
using (
  private.is_reacher_admin()
  or (user_id = (select auth.uid()) and (select private.has_reacher_access()))
)
with check (
  private.is_reacher_admin()
  or (user_id = (select auth.uid()) and (select private.has_reacher_access()))
);
