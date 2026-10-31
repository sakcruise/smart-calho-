-- Family Smart Calendar: only your household's accounts can read or write family data.
-- Paste into Supabase → SQL Editor → New query → Run. Safe to run once.

create table public.household_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.household_users enable row level security;

create or replace function public.is_household_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.household_users where user_id = auth.uid());
$$;
revoke all on function public.is_household_member() from public;
grant execute on function public.is_household_member() to authenticated;

create policy "members read household" on public.household_users for select to authenticated using (public.is_household_member());

create or replace function public.claim_first_household_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.household_users) then
    insert into public.household_users (user_id) values (new.id);
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.claim_first_household_user();

insert into public.household_users (user_id)
  select id from auth.users order by created_at limit 1
  on conflict do nothing;

do $$
declare t text;
begin
  foreach t in array array['family_members','settings','tasks','task_completions','rewards','star_ledger','events','lists','list_items','reminders','photos'] loop
    execute format('drop policy if exists "authenticated full access" on public.%I', t);
    execute format('create policy "household full access" on public.%I for all to authenticated using (public.is_household_member()) with check (public.is_household_member())', t);
  end loop;
end $$;

drop policy if exists "authenticated read photos" on storage.objects;
drop policy if exists "authenticated write photos" on storage.objects;
drop policy if exists "authenticated delete photos" on storage.objects;
create policy "household read photos" on storage.objects for select to authenticated using (bucket_id = 'photos' and public.is_household_member());
create policy "household write photos" on storage.objects for insert to authenticated with check (bucket_id = 'photos' and public.is_household_member());
create policy "household delete photos" on storage.objects for delete to authenticated using (bucket_id = 'photos' and public.is_household_member());
