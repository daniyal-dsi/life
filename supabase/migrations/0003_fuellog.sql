-- Life Organiser: step 3, Fuel Log.
--
-- Run once in the Supabase dashboard (SQL Editor > New query > paste > Run),
-- after 0002_liftlog.sql.
--
-- Same versioned layout as Lift Log: personal rows (user_id), never updated or
-- deleted. Saving adds a version with the same entity_id; deleting adds one
-- with deleted = true; the newest version per entity_id is current.

-- ---------------------------------------------------------------- tables

create table public.fuellog_profile (
  id uuid primary key,
  entity_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  deleted boolean not null default false,
  created_at timestamptz not null default now()
);
comment on table public.fuellog_profile is
  'Versioned, one entity per person. data: {weight_kg, height_cm, age, sex (male|female), activity (sedentary|light|moderate|very), goal (lose|maintain|gain), sample?}. Each version is the profile from its created_at onward.';
create index fuellog_profile_user on public.fuellog_profile (user_id, created_at);
create index fuellog_profile_entity on public.fuellog_profile (entity_id, created_at desc);

create table public.fuellog_foods (
  id uuid primary key,
  entity_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  deleted boolean not null default false,
  created_at timestamptz not null default now()
);
comment on table public.fuellog_foods is
  'Versioned. data: {name, kcal, p, c, f} per serving (macros may be null).';
create index fuellog_foods_user on public.fuellog_foods (user_id, created_at);
create index fuellog_foods_entity on public.fuellog_foods (entity_id, created_at desc);

create table public.fuellog_entries (
  id uuid primary key,
  entity_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  deleted boolean not null default false,
  created_at timestamptz not null default now()
);
comment on table public.fuellog_entries is
  'Versioned. data: {date, meal (breakfast|lunch|dinner|snacks), food_id, servings, name, kcal, p, c, f, sample?}. Food values are copied at logging time.';
create index fuellog_entries_user on public.fuellog_entries (user_id, created_at);
create index fuellog_entries_entity on public.fuellog_entries (entity_id, created_at desc);

create table public.fuellog_weights (
  id uuid primary key,
  entity_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  deleted boolean not null default false,
  created_at timestamptz not null default now()
);
comment on table public.fuellog_weights is
  'Versioned, one entity per date. data: {date, kg, sample?}.';
create index fuellog_weights_user on public.fuellog_weights (user_id, created_at);
create index fuellog_weights_entity on public.fuellog_weights (entity_id, created_at desc);

-- ---------------------------------------------------------------- RLS
-- Personal: owner reads and adds. No update or delete policies.

alter table public.fuellog_profile enable row level security;
create policy "fuellog_profile: read own" on public.fuellog_profile
  for select to authenticated using (user_id = auth.uid());
create policy "fuellog_profile: add own" on public.fuellog_profile
  for insert to authenticated with check (user_id = auth.uid());

alter table public.fuellog_foods enable row level security;
create policy "fuellog_foods: read own" on public.fuellog_foods
  for select to authenticated using (user_id = auth.uid());
create policy "fuellog_foods: add own" on public.fuellog_foods
  for insert to authenticated with check (user_id = auth.uid());

alter table public.fuellog_entries enable row level security;
create policy "fuellog_entries: read own" on public.fuellog_entries
  for select to authenticated using (user_id = auth.uid());
create policy "fuellog_entries: add own" on public.fuellog_entries
  for insert to authenticated with check (user_id = auth.uid());

alter table public.fuellog_weights enable row level security;
create policy "fuellog_weights: read own" on public.fuellog_weights
  for select to authenticated using (user_id = auth.uid());
create policy "fuellog_weights: add own" on public.fuellog_weights
  for insert to authenticated with check (user_id = auth.uid());

-- ---------------------------------------------------------------- views
-- security_invoker makes the views obey the tables' RLS.

-- Current food log, one row per logged food.
create view public.fuellog_entries_current with (security_invoker = true) as
select
  entity_id as entry_id,
  user_id,
  (data ->> 'date')::date as entry_date,
  data ->> 'meal' as meal,
  data ->> 'name' as food_name,
  (data ->> 'servings')::numeric as servings,
  (data ->> 'kcal')::numeric * (data ->> 'servings')::numeric as kcal,
  coalesce((data ->> 'p')::numeric, 0) * (data ->> 'servings')::numeric as protein_g,
  coalesce((data ->> 'c')::numeric, 0) * (data ->> 'servings')::numeric as carbs_g,
  coalesce((data ->> 'f')::numeric, 0) * (data ->> 'servings')::numeric as fat_g,
  coalesce((data ->> 'sample')::boolean, false) as sample
from (
  select distinct on (entity_id) * from public.fuellog_entries order by entity_id, created_at desc, id desc
) latest
where not deleted;

-- Daily totals.
create view public.fuellog_daily with (security_invoker = true) as
select user_id, entry_date, sum(kcal) as kcal, sum(protein_g) as protein_g, sum(carbs_g) as carbs_g,
  sum(fat_g) as fat_g, count(*) as items
from public.fuellog_entries_current
group by user_id, entry_date;

-- Current weigh-ins.
create view public.fuellog_weights_current with (security_invoker = true) as
select entity_id as weight_id, user_id, (data ->> 'date')::date as weigh_date, (data ->> 'kg')::numeric as kg,
  coalesce((data ->> 'sample')::boolean, false) as sample
from (
  select distinct on (entity_id) * from public.fuellog_weights order by entity_id, created_at desc, id desc
) latest
where not deleted;

grant select on public.fuellog_entries_current, public.fuellog_daily, public.fuellog_weights_current to authenticated;
revoke all on public.fuellog_entries_current, public.fuellog_daily, public.fuellog_weights_current from anon;
