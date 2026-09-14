-- Product-specific access and private progress storage for The Reacher Build.

create table if not exists public.product_entitlements (
  id uuid primary key default gen_random_uuid(),
  product_code text not null,
  purchaser_email text not null,
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'refunded', 'revoked')),
  source text not null default 'stripe' check (source in ('stripe', 'manual', 'migration')),
  stripe_customer_id text,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_entitlements_normalized_email check (purchaser_email = lower(trim(purchaser_email))),
  constraint product_entitlements_product_email_key unique (product_code, purchaser_email),
  constraint product_entitlements_checkout_key unique (stripe_checkout_session_id)
);

create index if not exists product_entitlements_user_product_idx
  on public.product_entitlements (user_id, product_code)
  where status = 'active';

create index if not exists product_entitlements_payment_intent_idx
  on public.product_entitlements (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

alter table public.product_entitlements enable row level security;
revoke all on table public.product_entitlements from anon, authenticated;
grant select, insert, update, delete on table public.product_entitlements to service_role;

create or replace function public.has_product_entitlement(requested_product_code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  caller_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
begin
  if caller_id is null or caller_email = '' then
    return false;
  end if;

  update public.product_entitlements
  set user_id = caller_id,
      updated_at = now()
  where product_code = requested_product_code
    and purchaser_email = caller_email
    and status = 'active'
    and revoked_at is null
    and (user_id is null or user_id = caller_id);

  return exists (
    select 1
    from public.product_entitlements
    where product_code = requested_product_code
      and user_id = caller_id
      and status = 'active'
      and revoked_at is null
  );
end;
$$;

revoke all on function public.has_product_entitlement(text) from public, anon;
grant execute on function public.has_product_entitlement(text) to authenticated;

create table if not exists public.reacher_tracker_states (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_code text not null default 'REACHER_BUILD',
  state jsonb not null default '{}'::jsonb check (jsonb_typeof(state) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, product_code)
);

alter table public.reacher_tracker_states enable row level security;
revoke all on table public.reacher_tracker_states from anon;
grant select, insert, update on table public.reacher_tracker_states to authenticated;
grant all on table public.reacher_tracker_states to service_role;

drop policy if exists reacher_tracker_states_select on public.reacher_tracker_states;
create policy reacher_tracker_states_select
on public.reacher_tracker_states for select
to authenticated
using (
  user_id = auth.uid()
  and public.has_product_entitlement(reacher_tracker_states.product_code)
);

drop policy if exists reacher_tracker_states_insert on public.reacher_tracker_states;
create policy reacher_tracker_states_insert
on public.reacher_tracker_states for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.has_product_entitlement(reacher_tracker_states.product_code)
);

drop policy if exists reacher_tracker_states_update on public.reacher_tracker_states;
create policy reacher_tracker_states_update
on public.reacher_tracker_states for update
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and public.has_product_entitlement(reacher_tracker_states.product_code)
);

insert into public.offers (
  code, version, name, description, amount_cents, currency, cadence,
  engagement_weeks, entitlements, is_available_at_signup, cancel_policy
)
values (
  'REACHER_BUILD', 1, 'The Reacher Build',
  'One-time purchase granting access to the private 36-week Reacher Build blueprint tracker.',
  null, 'USD', 'one_time', 36, '{"reacher_build": true}'::jsonb, false, 'no_cancel'
)
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    cadence = excluded.cadence,
    engagement_weeks = excluded.engagement_weeks,
    entitlements = excluded.entitlements,
    updated_at = now();
