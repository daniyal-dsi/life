-- Life Organiser: step 6a, Calendar planner.
--
-- Run once in the Supabase dashboard (SQL Editor > New query > paste > Run),
-- after 0007_mealprep_plan.sql.
--
-- Same versioned layout as the other modules: personal rows (user_id), never
-- updated or deleted. Saving adds a version with the same entity_id; deleting
-- adds one with deleted = true; the newest version per entity_id is current.

-- ---------------------------------------------------------------- tables

create table public.calendar_blocks (
  id uuid primary key,
  entity_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  deleted boolean not null default false,
  created_at timestamptz not null default now()
);
comment on table public.calendar_blocks is
  'Versioned. data: {date, start_min, end_min (minutes from midnight, UK time), kind (bucket|gym), bucket_id, task_id, task_title, template_id, template_name, google_event_id}. Task and template names are copied when planned.';
create index calendar_blocks_user on public.calendar_blocks (user_id, created_at);
create index calendar_blocks_entity on public.calendar_blocks (entity_id, created_at desc);

create table public.calendar_work (
  id uuid primary key,
  entity_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  deleted boolean not null default false,
  created_at timestamptz not null default now()
);
comment on table public.calendar_work is
  'Versioned work hours. One entity {kind: usual, start_min, end_min} for Monday to Friday, plus one entity per date that differs: {kind: day, date, start_min, end_min, off}.';
create index calendar_work_user on public.calendar_work (user_id, created_at);
create index calendar_work_entity on public.calendar_work (entity_id, created_at desc);

-- ---------------------------------------------------------------- RLS
-- Personal: owner reads and adds. No update or delete policies.

alter table public.calendar_blocks enable row level security;
create policy "calendar_blocks: read own" on public.calendar_blocks
  for select to authenticated using (user_id = auth.uid());
create policy "calendar_blocks: add own" on public.calendar_blocks
  for insert to authenticated with check (user_id = auth.uid());

alter table public.calendar_work enable row level security;
create policy "calendar_work: read own" on public.calendar_work
  for select to authenticated using (user_id = auth.uid());
create policy "calendar_work: add own" on public.calendar_work
  for insert to authenticated with check (user_id = auth.uid());

-- ---------------------------------------------------------------- views
-- security_invoker makes the views obey the tables' RLS.

-- Current planned blocks, one row per block.
create view public.calendar_blocks_current with (security_invoker = true) as
select
  entity_id as block_id,
  user_id,
  (data ->> 'date')::date as block_date,
  (data ->> 'start_min')::int as start_min,
  (data ->> 'end_min')::int as end_min,
  (data ->> 'end_min')::int - (data ->> 'start_min')::int as minutes,
  data ->> 'kind' as kind,
  (data ->> 'bucket_id')::uuid as bucket_id,
  data ->> 'task_title' as task_title,
  data ->> 'template_name' as template_name
from (
  select distinct on (entity_id) * from public.calendar_blocks order by entity_id, created_at desc, id desc
) latest
where not deleted;

-- Current work-hour rows (usual hours and per-day changes).
create view public.calendar_work_current with (security_invoker = true) as
select
  entity_id as work_id,
  user_id,
  data ->> 'kind' as kind,
  (data ->> 'date')::date as work_date,
  (data ->> 'start_min')::int as start_min,
  (data ->> 'end_min')::int as end_min,
  coalesce((data ->> 'off')::boolean, false) as off
from (
  select distinct on (entity_id) * from public.calendar_work order by entity_id, created_at desc, id desc
) latest
where not deleted;

grant select on public.calendar_blocks_current, public.calendar_work_current to authenticated;
revoke all on public.calendar_blocks_current, public.calendar_work_current from anon;
