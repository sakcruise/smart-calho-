-- Voice: Home Assistant calls our voice function with a per-family token; what it heard and said is logged for the wall.
create table if not exists public.voice_tokens (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.current_household_id() references public.households(id) on delete cascade,
  token_hash text not null unique,
  label text not null default 'Home Assistant',
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
alter table public.voice_tokens enable row level security;
create policy "household full access" on public.voice_tokens for all to authenticated
  using (household_id = public.current_household_id()) with check (household_id = public.current_household_id());

create table if not exists public.voice_log (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  heard text,
  reply text not null,
  intent text,
  ok boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists voice_log_household_idx on public.voice_log (household_id, created_at desc);
alter table public.voice_log enable row level security;
create policy "household read voice log" on public.voice_log for select to authenticated
  using (household_id = public.current_household_id());
alter publication supabase_realtime add table public.voice_log;

-- A parent makes a token for their Home Assistant; it is shown once and only its hash is kept
create or replace function public.create_voice_token(token_label text default 'Home Assistant') returns text
language plpgsql security definer set search_path = public as $$
declare hh uuid := public.current_household_id(); tok text;
begin
  if hh is null then raise exception 'Not in a family'; end if;
  tok := 'fam_' || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into public.voice_tokens (household_id, token_hash, label)
    values (hh, encode(sha256(convert_to(tok, 'UTF8')), 'hex'), left(coalesce(nullif(trim(token_label), ''), 'Home Assistant'), 60));
  return tok;
end $$;
revoke execute on function public.create_voice_token(text) from anon, public;
grant execute on function public.create_voice_token(text) to authenticated;
