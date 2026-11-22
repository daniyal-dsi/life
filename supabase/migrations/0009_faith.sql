-- Life Organiser: step 7a, Faith prayers.
--
-- Run once in the Supabase dashboard (SQL Editor > New query > paste > Run),
-- after 0008_calendar.sql.
--
-- faith_prayers is personal (user_id). faith_mosque is shared by the
-- household, like Meal Prep: every member reads and adds versions; nobody
-- updates or deletes a row. Asr method, main time and location live in each
-- person's settings.

-- ---------------------------------------------------------------- tables

create table public.faith_prayers (
  id uuid primary key,
  entity_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  deleted boolean not null default false,
  created_at timestamptz not null default now()
);
comment on table public.faith_prayers is
  'Versioned, one entity per date and prayer. data: {date, prayer (fajr|zuhr|asr|maghrib|isha), time (minutes from that date''s midnight, UK time; Isha after midnight is over 1440), place (home|mosque), combined (the partner prayer or null)}.';
create index faith_prayers_user on public.faith_prayers (user_id, created_at);
create index faith_prayers_entity on public.faith_prayers (entity_id, created_at desc);

create table public.faith_mosque (
  id uuid primary key,
  entity_id uuid not null,
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  deleted boolean not null default false,
  created_at timestamptz not null default now()
);
comment on table public.faith_mosque is
  'Versioned Masjid Mubarak congregation times, shared by the household; one entity per start date. data: {from, times: {fajr, zuhr, asr, maghrib, isha, jumuah: "HH:MM" or "sunset"}, raw (the message), source (paste|whatsapp)}.';
create index faith_mosque_household on public.faith_mosque (household_id, created_at);
create index faith_mosque_entity on public.faith_mosque (entity_id, created_at desc);

-- ---------------------------------------------------------------- RLS

alter table public.faith_prayers enable row level security;
create policy "faith_prayers: read own" on public.faith_prayers
  for select to authenticated using (user_id = auth.uid());
create policy "faith_prayers: add own" on public.faith_prayers
  for insert to authenticated with check (user_id = auth.uid());

alter table public.faith_mosque enable row level security;
create policy "faith_mosque: household reads" on public.faith_mosque
  for select to authenticated using (public.is_household_member(household_id));
create policy "faith_mosque: household adds" on public.faith_mosque
  for insert to authenticated with check (user_id = auth.uid() and public.is_household_member(household_id));

-- ---------------------------------------------------------------- views
-- security_invoker makes the views obey the tables' RLS.

create view public.faith_prayers_current with (security_invoker = true) as
select
  entity_id as log_id,
  user_id,
  (data ->> 'date')::date as prayer_date,
  data ->> 'prayer' as prayer,
  (data ->> 'time')::int as minutes,
  data ->> 'place' as place,
  data ->> 'combined' as combined_with
from (
  select distinct on (entity_id) * from public.faith_prayers order by entity_id, created_at desc, id desc
) latest
where not deleted;

create view public.faith_mosque_current with (security_invoker = true) as
select
  entity_id as update_id,
  household_id,
  (data ->> 'from')::date as from_date,
  data -> 'times' as times,
  data ->> 'source' as source,
  created_at
from (
  select distinct on (entity_id) * from public.faith_mosque order by entity_id, created_at desc, id desc
) latest
where not deleted;

grant select on public.faith_prayers_current, public.faith_mosque_current to authenticated;
revoke all on public.faith_prayers_current, public.faith_mosque_current from anon;
