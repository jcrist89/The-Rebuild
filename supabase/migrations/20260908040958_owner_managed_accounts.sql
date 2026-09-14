-- Replace Stripe purchase entitlements with owner-created Reacher Build accounts.

create table if not exists public.reacher_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  auth_email text not null unique,
  display_name text not null,
  role text not null default 'buyer' check (role in ('admin', 'buyer')),
  status text not null default 'active' check (status in ('active', 'disabled')),
  must_change_password boolean not null default true,
  password_changed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reacher_accounts_normalized_username check (username = lower(trim(username))),
  constraint reacher_accounts_username_format check (username ~ '^[a-z0-9][a-z0-9._-]{2,31}$'),
  constraint reacher_accounts_normalized_email check (auth_email = lower(trim(auth_email)))
);

create index if not exists reacher_accounts_created_by_idx
  on public.reacher_accounts (created_by)
  where created_by is not null;

alter table public.reacher_accounts enable row level security;
revoke all on table public.reacher_accounts from public, anon, authenticated;
grant select, insert, update, delete on table public.reacher_accounts to service_role;

drop policy if exists reacher_accounts_deny_clients on public.reacher_accounts;
create policy reacher_accounts_deny_clients
on public.reacher_accounts for all
to anon, authenticated
using (false)
with check (false);

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create or replace function private.has_reacher_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.reacher_accounts
    where user_id = (select auth.uid())
      and status = 'active'
      and must_change_password = false
  );
$$;

revoke all on function private.has_reacher_access() from public, anon;
grant execute on function private.has_reacher_access() to authenticated;

drop policy if exists reacher_tracker_states_select on public.reacher_tracker_states;
create policy reacher_tracker_states_select
on public.reacher_tracker_states for select
to authenticated
using (
  user_id = (select auth.uid())
  and product_code = 'REACHER_BUILD'
  and (select private.has_reacher_access())
);

drop policy if exists reacher_tracker_states_insert on public.reacher_tracker_states;
create policy reacher_tracker_states_insert
on public.reacher_tracker_states for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and product_code = 'REACHER_BUILD'
  and (select private.has_reacher_access())
);

drop policy if exists reacher_tracker_states_update on public.reacher_tracker_states;
create policy reacher_tracker_states_update
on public.reacher_tracker_states for update
to authenticated
using (
  user_id = (select auth.uid())
  and product_code = 'REACHER_BUILD'
  and (select private.has_reacher_access())
)
with check (
  user_id = (select auth.uid())
  and product_code = 'REACHER_BUILD'
  and (select private.has_reacher_access())
);

drop function if exists public.has_reacher_access();
drop function if exists public.has_product_entitlement(text);
drop table if exists public.product_entitlements;

update public.offers
set description = 'Owner-managed access to the private 36-week Reacher Build blueprint tracker.',
    updated_at = now()
where code = 'REACHER_BUILD';
