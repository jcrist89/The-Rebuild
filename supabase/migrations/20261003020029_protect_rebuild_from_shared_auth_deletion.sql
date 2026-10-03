-- Auth is shared with the coaching portal. Block implicit destruction of tracker data.
alter table public.reacher_accounts
  drop constraint reacher_accounts_user_id_fkey,
  add constraint reacher_accounts_user_id_fkey foreign key (user_id) references auth.users(id) on delete restrict;
alter table public.reacher_tracker_states
  drop constraint reacher_tracker_states_user_id_fkey,
  add constraint reacher_tracker_states_user_id_fkey foreign key (user_id) references auth.users(id) on delete restrict;
