-- Pantry: what's at home. Ticking a grocery item as bought stocks it up and logs the purchase,
-- so the app learns how long things usually last.
create or replace function public.pantry_key(t text) returns text
language sql immutable set search_path = public as $$
  with b as (
    select regexp_replace(regexp_replace(lower(trim(coalesce(t, ''))),
      '^[0-9½¼¾.,/\- ]+\s*(g|kg|ml|l|x|pack|packs|tin|tins|bag|bags|bottle|bottles)?\s+', ''), '\s+', ' ', 'g') as x
  )
  select case
    when x ~ 'oes$' then regexp_replace(x, 'oes$', 'o')
    when x ~ 'ies$' then regexp_replace(x, 'ies$', 'y')
    when x ~ 'es$' then regexp_replace(x, 'es$', '')
    else regexp_replace(x, 's$', '') end
  from b
$$;

create table if not exists public.pantry_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.current_household_id() references public.households(id) on delete cascade,
  name text not null,
  key text not null,
  level text not null default 'full' check (level in ('full', 'half', 'low', 'out')),
  last_bought_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index if not exists pantry_items_household_key on public.pantry_items (household_id, key);
alter table public.pantry_items enable row level security;
create policy "household full access" on public.pantry_items for all to authenticated
  using (household_id = public.current_household_id()) with check (household_id = public.current_household_id());

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.current_household_id() references public.households(id) on delete cascade,
  key text not null,
  bought_at timestamptz not null default now()
);
create index if not exists purchases_household_key_idx on public.purchases (household_id, key, bought_at desc);
alter table public.purchases enable row level security;
create policy "household full access" on public.purchases for all to authenticated
  using (household_id = public.current_household_id()) with check (household_id = public.current_household_id());

create or replace function public.stock_from_list() returns trigger
language plpgsql security definer set search_path = public as $$
declare k text; kind text; nm text;
begin
  if new.done and not coalesce(old.done, false) then
    select l.kind into kind from public.lists l where l.id = new.list_id;
    if kind is distinct from 'grocery' then return new; end if;
    k := public.pantry_key(new.text);
    if k = '' then return new; end if;
    nm := regexp_replace(trim(new.text), '^[0-9½¼¾.,/\- ]+\s*(g|kg|ml|l|x|pack|packs|tin|tins|bag|bags|bottle|bottles)?\s+', '', 'i');
    nm := upper(left(nm, 1)) || substr(nm, 2);
    insert into public.pantry_items (household_id, name, key, level, last_bought_at, updated_at)
      values (new.household_id, nm, k, 'full', now(), now())
      on conflict (household_id, key) do update set level = 'full', last_bought_at = now(), updated_at = now();
    if not exists (select 1 from public.purchases p where p.household_id = new.household_id and p.key = k and p.bought_at > now() - interval '20 hours') then
      insert into public.purchases (household_id, key) values (new.household_id, k);
    end if;
  end if;
  return new;
end $$;
create trigger list_items_stock_pantry after update of done on public.list_items
  for each row execute function public.stock_from_list();

create or replace view public.pantry_forecast with (security_invoker = true) as
  select p.household_id, p.key,
         count(*) as times_bought,
         max(p.bought_at) as last_bought_at,
         case when count(*) >= 2 then extract(epoch from (max(p.bought_at) - min(p.bought_at))) / 86400 / (count(*) - 1) end as avg_days
  from public.purchases p group by p.household_id, p.key;

alter publication supabase_realtime add table public.pantry_items;
