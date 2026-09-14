-- Make the server-only table policy explicit and optimize Reacher state RLS init plans.

create index if not exists product_entitlements_user_id_idx
  on public.product_entitlements (user_id);

drop policy if exists product_entitlements_deny_clients on public.product_entitlements;
create policy product_entitlements_deny_clients
on public.product_entitlements for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists reacher_tracker_states_select on public.reacher_tracker_states;
create policy reacher_tracker_states_select
on public.reacher_tracker_states for select
to authenticated
using (
  user_id = (select auth.uid())
  and product_code = 'REACHER_BUILD'
  and (select public.has_product_entitlement('REACHER_BUILD'))
);

drop policy if exists reacher_tracker_states_insert on public.reacher_tracker_states;
create policy reacher_tracker_states_insert
on public.reacher_tracker_states for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and product_code = 'REACHER_BUILD'
  and (select public.has_product_entitlement('REACHER_BUILD'))
);

drop policy if exists reacher_tracker_states_update on public.reacher_tracker_states;
create policy reacher_tracker_states_update
on public.reacher_tracker_states for update
to authenticated
using (
  user_id = (select auth.uid())
  and product_code = 'REACHER_BUILD'
  and (select public.has_product_entitlement('REACHER_BUILD'))
)
with check (
  user_id = (select auth.uid())
  and product_code = 'REACHER_BUILD'
  and (select public.has_product_entitlement('REACHER_BUILD'))
);
