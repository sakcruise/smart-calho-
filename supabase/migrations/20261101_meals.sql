-- Weekly menu: the family's dishes (with ingredients) and which dish is on which day.
create table if not exists public.dishes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.current_household_id() references public.households(id) on delete cascade,
  name text not null,
  ingredients text[] not null default '{}',
  created_at timestamptz not null default now()
);
create unique index if not exists dishes_household_name_key on public.dishes (household_id, lower(name));
alter table public.dishes enable row level security;
create policy "household full access" on public.dishes for all to authenticated
  using (household_id = public.current_household_id()) with check (household_id = public.current_household_id());

create table if not exists public.meal_plan (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.current_household_id() references public.households(id) on delete cascade,
  date date not null,
  slot text not null check (slot in ('breakfast', 'lunch', 'dinner')),
  dish_id uuid references public.dishes(id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now()
);
create index if not exists meal_plan_household_date_idx on public.meal_plan (household_id, date);
alter table public.meal_plan enable row level security;
create policy "household full access" on public.meal_plan for all to authenticated
  using (household_id = public.current_household_id()) with check (household_id = public.current_household_id());

alter publication supabase_realtime add table public.dishes, public.meal_plan;
