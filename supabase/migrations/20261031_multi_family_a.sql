-- Multi-family, part A (additive): every row belongs to a household; members only see their own.
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Our family',
  is_app_owner boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now()
);
alter table public.households enable row level security;

alter table public.household_users add column if not exists household_id uuid references public.households(id) on delete cascade;

-- The household of the signed-in account (null if none)
create or replace function public.current_household_id() returns uuid
language sql stable security definer set search_path = public as $$
  select household_id from public.household_users where user_id = auth.uid()
$$;

-- Existing family becomes the first household (and owns the app-wide Google keys)
do $$
declare hh uuid;
begin
  if not exists (select 1 from public.households) then
    insert into public.households (name, is_app_owner)
      values (coalesce((select value #>> '{}' from public.settings where key = 'family_name'), 'Our family'), true)
      returning id into hh;
  else
    select id into hh from public.households order by created_at limit 1;
  end if;
  update public.household_users set household_id = hh where household_id is null;
end $$;

-- household_id on every family table, filled for existing rows, defaulting to the caller's family
do $$
declare t text; hh uuid := (select id from public.households where is_app_owner order by created_at limit 1);
begin
  foreach t in array array['family_members','settings','tasks','task_completions','rewards','star_ledger','events','lists',
    'list_items','reminders','photos','calendar_sources','devices','app_errors','household_invites','backups',
    'push_subscriptions','google_logins','google_connect_states'] loop
    execute format('alter table public.%I add column if not exists household_id uuid references public.households(id) on delete cascade', t);
    execute format('update public.%I set household_id = %L where household_id is null', t, hh);
    execute format('alter table public.%I alter column household_id set default public.current_household_id()', t);
    execute format('create index if not exists %I on public.%I (household_id)', t || '_household_idx', t);
  end loop;
end $$;

-- These are always written by the app as a signed-in member, so they must have a family
alter table public.household_users alter column household_id set not null;
do $$
declare t text;
begin
  foreach t in array array['family_members','settings','tasks','task_completions','rewards','star_ledger','events','lists',
    'list_items','reminders','photos','calendar_sources','devices','app_errors','household_invites','backups','push_subscriptions','google_logins'] loop
    execute format('alter table public.%I alter column household_id set not null', t);
  end loop;
end $$;

-- Row access: your own family only
do $$
declare t text;
begin
  foreach t in array array['family_members','settings','tasks','task_completions','rewards','star_ledger','events','lists',
    'list_items','reminders','photos','calendar_sources','devices','app_errors','household_invites','push_subscriptions'] loop
    execute format('alter policy "household full access" on public.%I using (household_id = public.current_household_id()) with check (household_id = public.current_household_id())', t);
  end loop;
end $$;
alter policy "members read household" on public.household_users using (household_id = public.current_household_id());
alter policy "household read backups" on public.backups using (household_id = public.current_household_id());
create policy "read own household" on public.households for select to authenticated using (id = public.current_household_id());
create policy "rename own household" on public.households for update to authenticated
  using (id = public.current_household_id()) with check (id = public.current_household_id());

-- Photos: new uploads go under "<household id>/…"; older files are reachable through their family's rows
alter policy "household read photos" on storage.objects using (
  bucket_id = 'photos' and (
    (storage.foldername(name))[1] = public.current_household_id()::text
    or exists (select 1 from public.photos p where p.storage_path = objects.name and p.household_id = public.current_household_id())
    or exists (select 1 from public.rewards r where r.image_path = objects.name and r.household_id = public.current_household_id())));
alter policy "household write photos" on storage.objects with check (
  bucket_id = 'photos' and (storage.foldername(name))[1] = public.current_household_id()::text);
alter policy "household delete photos" on storage.objects using (
  bucket_id = 'photos' and (
    (storage.foldername(name))[1] = public.current_household_id()::text
    or exists (select 1 from public.photos p where p.storage_path = objects.name and p.household_id = public.current_household_id())
    or exists (select 1 from public.rewards r where r.image_path = objects.name and r.household_id = public.current_household_id())));

-- New accounts no longer join automatically; they create a family or join one with a code
create or replace function public.claim_first_household_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  return new;
end $$;

create or replace function public.create_household(family_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare hh uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select household_id into hh from public.household_users where user_id = auth.uid();
  if hh is not null then return hh; end if;
  insert into public.households (name, created_by) values (left(coalesce(nullif(trim(family_name), ''), 'Our family'), 80), auth.uid())
    returning id into hh;
  insert into public.household_users (user_id, household_id) values (auth.uid(), hh);
  return hh;
end $$;

create or replace function public.join_household(invite_code text) returns boolean
language plpgsql security definer set search_path = public as $$
declare inv public.household_invites;
begin
  if auth.uid() is null then return false; end if;
  if exists (select 1 from public.household_users where user_id = auth.uid()) then return true; end if;
  select * into inv from public.household_invites
    where code = upper(trim(invite_code)) and used_at is null and expires_at > now() for update;
  if not found then return false; end if;
  insert into public.household_users (user_id, household_id) values (auth.uid(), inv.household_id) on conflict do nothing;
  update public.household_invites set used_by = auth.uid(), used_at = now() where code = inv.code;
  return true;
end $$;

-- Google sign-in keys are app-wide: only the app owner's family may change them
create or replace function public.set_google_credentials(client_id text, client_secret text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.households where id = public.current_household_id() and is_app_owner) then return false; end if;
  insert into public.app_secrets (name, value) values ('google_client_id', trim(client_id))
    on conflict (name) do update set value = excluded.value;
  insert into public.app_secrets (name, value) values ('google_client_secret', trim(client_secret))
    on conflict (name) do update set value = excluded.value;
  return true;
end $$;

create or replace function public.google_ready() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_secrets where name = 'google_client_id')
$$;

grant execute on function public.current_household_id() to authenticated;
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.google_ready() to authenticated;

-- Nightly backup: one set of 14 rotating slots per family
create unique index if not exists backups_household_slot_key on public.backups (household_id, slot);
create or replace function public.take_backup() returns void
language plpgsql security definer set search_path = public as $$
declare h uuid;
begin
  -- Callable by the nightly job (all families), or by a member through the API (their family only)
  if session_user = 'authenticator' and not public.is_household_member() then raise exception 'not allowed'; end if;
  for h in select id from public.households
           where session_user <> 'authenticator' or id = public.current_household_id() loop
    insert into public.backups (household_id, slot, taken_at, data) select h, (current_date - date '2000-01-01') % 14, now(), jsonb_build_object(
      'family_members', (select coalesce(jsonb_agg(t), '[]') from public.family_members t where household_id = h),
      'settings', (select coalesce(jsonb_agg(t), '[]') from public.settings t where household_id = h),
      'tasks', (select coalesce(jsonb_agg(t), '[]') from public.tasks t where household_id = h),
      'task_completions', (select coalesce(jsonb_agg(t), '[]') from public.task_completions t where household_id = h and date > current_date - 120),
      'rewards', (select coalesce(jsonb_agg(t), '[]') from public.rewards t where household_id = h),
      'star_ledger', (select coalesce(jsonb_agg(t), '[]') from public.star_ledger t where household_id = h),
      'events', (select coalesce(jsonb_agg(t), '[]') from public.events t where household_id = h and source = 'local'),
      'lists', (select coalesce(jsonb_agg(t), '[]') from public.lists t where household_id = h),
      'list_items', (select coalesce(jsonb_agg(t), '[]') from public.list_items t where household_id = h),
      'reminders', (select coalesce(jsonb_agg(t), '[]') from public.reminders t where household_id = h),
      'photos', (select coalesce(jsonb_agg(t), '[]') from public.photos t where household_id = h),
      'calendar_sources', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'provider', provider, 'member_ids', member_ids)), '[]') from public.calendar_sources where household_id = h)
    )
    on conflict (household_id, slot) do update set taken_at = excluded.taken_at, data = excluded.data;
  end loop;
end $$;
