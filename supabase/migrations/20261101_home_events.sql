create table if not exists public.home_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.current_household_id() references public.households(id) on delete cascade,
  kind text not null default 'doorbell',
  title text not null,
  camera text,
  image_path text,
  notified_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists home_events_household_idx on public.home_events (household_id, created_at desc);
alter table public.home_events enable row level security;
create policy "household full access" on public.home_events for all to authenticated
  using (household_id = public.current_household_id()) with check (household_id = public.current_household_id());
alter publication supabase_realtime add table public.home_events;
