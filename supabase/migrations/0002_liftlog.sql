-- Life Organiser: step 2, Lift Log.
--
-- Run once in the Supabase dashboard (SQL Editor > New query > paste > Run),
-- after 0001_foundations.sql.
--
-- Lift Log data is personal (user_id) and versioned: the app never updates or
-- deletes a row. Saving an exercise, template or workout adds a new version
-- with the same entity_id; deleting adds a version with deleted = true. The
-- newest version per entity_id is the current state; older ones are history.
-- The *_current views below give the current state for analysis.

-- ---------------------------------------------------------------- tables

create table public.liftlog_exercises (
  id uuid primary key,
  entity_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  deleted boolean not null default false,
  created_at timestamptz not null default now()
);
comment on table public.liftlog_exercises is
  'Versioned. data: {name, group (chest|back|legs|shoulders|arms|core), custom}.';

create table public.liftlog_templates (
  id uuid primary key,
  entity_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  deleted boolean not null default false,
  created_at timestamptz not null default now()
);
comment on table public.liftlog_templates is
  'Versioned. data: {name, items: [{exercise_id, sets, reps}]}.';

create table public.liftlog_workouts (
  id uuid primary key,
  entity_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  deleted boolean not null default false,
  created_at timestamptz not null default now()
);
comment on table public.liftlog_workouts is
  'Versioned. data: {date (YYYY-MM-DD), note, template_id, sample?, entries: [{exercise_id, sets: [{w (kg), r}]}]}.';

create index liftlog_exercises_user on public.liftlog_exercises (user_id, created_at);
create index liftlog_templates_user on public.liftlog_templates (user_id, created_at);
create index liftlog_workouts_user on public.liftlog_workouts (user_id, created_at);
create index liftlog_exercises_entity on public.liftlog_exercises (entity_id, created_at desc);
create index liftlog_templates_entity on public.liftlog_templates (entity_id, created_at desc);
create index liftlog_workouts_entity on public.liftlog_workouts (entity_id, created_at desc);

-- ---------------------------------------------------------------- RLS
-- Personal: owner reads and adds. No update or delete policies.

alter table public.liftlog_exercises enable row level security;
alter table public.liftlog_templates enable row level security;
alter table public.liftlog_workouts enable row level security;

create policy "liftlog_exercises: read own" on public.liftlog_exercises
  for select to authenticated using (user_id = auth.uid());
create policy "liftlog_exercises: add own" on public.liftlog_exercises
  for insert to authenticated with check (user_id = auth.uid());

create policy "liftlog_templates: read own" on public.liftlog_templates
  for select to authenticated using (user_id = auth.uid());
create policy "liftlog_templates: add own" on public.liftlog_templates
  for insert to authenticated with check (user_id = auth.uid());

create policy "liftlog_workouts: read own" on public.liftlog_workouts
  for select to authenticated using (user_id = auth.uid());
create policy "liftlog_workouts: add own" on public.liftlog_workouts
  for insert to authenticated with check (user_id = auth.uid());

-- ---------------------------------------------------------------- views
-- security_invoker makes the views obey the tables' RLS, so each person only
-- ever sees their own rows through them.

create view public.liftlog_workouts_current with (security_invoker = true) as
select entity_id as workout_id, user_id, (data ->> 'date')::date as workout_date, data, created_at as updated_at
from (
  select distinct on (entity_id) *
  from public.liftlog_workouts
  order by entity_id, created_at desc, id desc
) latest
where not deleted;

create view public.liftlog_exercises_current with (security_invoker = true) as
select entity_id as exercise_id, user_id, data ->> 'name' as name, data ->> 'group' as muscle_group,
  coalesce((data ->> 'custom')::boolean, false) as custom
from (
  select distinct on (entity_id) *
  from public.liftlog_exercises
  order by entity_id, created_at desc, id desc
) latest
where not deleted;

-- One row per logged set, for analysis (volume, progression, PRs over time).
create view public.liftlog_sets with (security_invoker = true) as
select
  w.workout_id,
  w.user_id,
  w.workout_date,
  (entry ->> 'exercise_id')::uuid as exercise_id,
  e.name as exercise_name,
  e.muscle_group,
  entry_no,
  set_no,
  (s ->> 'w')::numeric as weight_kg,
  (s ->> 'r')::int as reps,
  coalesce((w.data ->> 'sample')::boolean, false) as sample
from public.liftlog_workouts_current w
cross join lateral jsonb_array_elements(w.data -> 'entries') with ordinality as en (entry, entry_no)
cross join lateral jsonb_array_elements(entry -> 'sets') with ordinality as st (s, set_no)
left join public.liftlog_exercises_current e on e.exercise_id = (entry ->> 'exercise_id')::uuid;

grant select on public.liftlog_workouts_current, public.liftlog_exercises_current, public.liftlog_sets to authenticated;
revoke all on public.liftlog_workouts_current, public.liftlog_exercises_current, public.liftlog_sets from anon;
