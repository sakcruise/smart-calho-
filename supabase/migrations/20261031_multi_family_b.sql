-- Multi-family, part B: keys that were app-wide become per family; tidy function permissions.
create unique index if not exists google_logins_household_email_key on public.google_logins (household_id, google_email);
alter table public.google_connect_states alter column household_id drop default;
alter table public.settings drop constraint settings_pkey;
alter table public.settings add primary key (household_id, key);
drop index if exists public.backups_slot_key;
alter table public.backups drop constraint if exists backups_slot_key;
alter table public.google_logins drop constraint if exists google_logins_google_email_key;

revoke execute on function public.is_household_member() from anon, public;
revoke execute on function public.current_household_id() from anon, public;
revoke execute on function public.create_household(text) from anon, public;
revoke execute on function public.join_household(text) from anon, public;
revoke execute on function public.set_google_credentials(text, text) from anon, public;
revoke execute on function public.google_ready() from anon, public;
revoke execute on function public.take_backup() from anon, public;
revoke execute on function public.claim_first_household_user() from anon, public, authenticated;
grant execute on function public.is_household_member() to authenticated;
grant execute on function public.join_household(text) to authenticated;
grant execute on function public.set_google_credentials(text, text) to authenticated;
grant execute on function public.take_backup() to authenticated;
