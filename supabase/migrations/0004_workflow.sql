-- Life Organiser: step 4, Workflow.
--
-- Run once in the Supabase dashboard (SQL Editor > New query > paste > Run),
-- after 0003_fuellog.sql.
--
-- Same versioned layout as Lift Log and Fuel Log: personal rows (user_id),
-- never updated or deleted. Saving adds a version with the same entity_id;
-- deleting adds one with deleted = true; the newest version is current.

-- ---------------------------------------------------------------- tables

create table public.workflow_buckets (
  id uuid primary key,
  entity_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  deleted boolean not null default false,
  created_at timestamptz not null default now()
);
comment on table public.workflow_buckets is
  'Versioned. data: {name, color (coral|violet|sun|green), order}.';
create index workflow_buckets_user on public.workflow_buckets (user_id, created_at);
create index workflow_buckets_entity on public.workflow_buckets (entity_id, created_at desc);

create table public.workflow_projects (
  id uuid primary key,
  entity_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  deleted boolean not null default false,
  created_at timestamptz not null default now()
);
comment on table public.workflow_projects is
  'Versioned. data: {bucket_id, name, description, priority (P1|P2|P3), status (Planning|In progress|Blocked|Done), due (YYYY-MM-DD or null), people: [person ids], sample?}.';
create index workflow_projects_user on public.workflow_projects (user_id, created_at);
create index workflow_projects_entity on public.workflow_projects (entity_id, created_at desc);

create table public.workflow_milestones (
  id uuid primary key,
  entity_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  deleted boolean not null default false,
  created_at timestamptz not null default now()
);
comment on table public.workflow_milestones is
  'Versioned. data: {project_id, title, owner_id, due, done, done_at, order, sample?}.';
create index workflow_milestones_user on public.workflow_milestones (user_id, created_at);
create index workflow_milestones_entity on public.workflow_milestones (entity_id, created_at desc);

create table public.workflow_people (
  id uuid primary key,
  entity_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  deleted boolean not null default false,
  created_at timestamptz not null default now()
);
comment on table public.workflow_people is
  'Versioned. Names only, no accounts. data: {name, initials, role, me?, sample?}.';
create index workflow_people_user on public.workflow_people (user_id, created_at);
create index workflow_people_entity on public.workflow_people (entity_id, created_at desc);

-- ---------------------------------------------------------------- RLS
-- Personal: owner reads and adds. No update or delete policies.

alter table public.workflow_buckets enable row level security;
create policy "workflow_buckets: read own" on public.workflow_buckets
  for select to authenticated using (user_id = auth.uid());
create policy "workflow_buckets: add own" on public.workflow_buckets
  for insert to authenticated with check (user_id = auth.uid());

alter table public.workflow_projects enable row level security;
create policy "workflow_projects: read own" on public.workflow_projects
  for select to authenticated using (user_id = auth.uid());
create policy "workflow_projects: add own" on public.workflow_projects
  for insert to authenticated with check (user_id = auth.uid());

alter table public.workflow_milestones enable row level security;
create policy "workflow_milestones: read own" on public.workflow_milestones
  for select to authenticated using (user_id = auth.uid());
create policy "workflow_milestones: add own" on public.workflow_milestones
  for insert to authenticated with check (user_id = auth.uid());

alter table public.workflow_people enable row level security;
create policy "workflow_people: read own" on public.workflow_people
  for select to authenticated using (user_id = auth.uid());
create policy "workflow_people: add own" on public.workflow_people
  for insert to authenticated with check (user_id = auth.uid());

-- ---------------------------------------------------------------- views
-- security_invoker makes the views obey the tables' RLS.

create view public.workflow_projects_current with (security_invoker = true) as
select entity_id as project_id, user_id, (data ->> 'bucket_id')::uuid as bucket_id, data ->> 'name' as name,
  data ->> 'priority' as priority, data ->> 'status' as status, (data ->> 'due')::date as due,
  coalesce((data ->> 'sample')::boolean, false) as sample, created_at as updated_at
from (
  select distinct on (entity_id) * from public.workflow_projects order by entity_id, created_at desc, id desc
) latest
where not deleted;

create view public.workflow_milestones_current with (security_invoker = true) as
select entity_id as milestone_id, user_id, (data ->> 'project_id')::uuid as project_id, data ->> 'title' as title,
  (data ->> 'owner_id')::uuid as owner_id, (data ->> 'due')::date as due, coalesce((data ->> 'done')::boolean, false) as done,
  (data ->> 'done_at')::date as done_at, (data ->> 'order')::int as sort_order,
  coalesce((data ->> 'sample')::boolean, false) as sample, created_at as updated_at
from (
  select distinct on (entity_id) * from public.workflow_milestones order by entity_id, created_at desc, id desc
) latest
where not deleted;

grant select on public.workflow_projects_current, public.workflow_milestones_current to authenticated;
revoke all on public.workflow_projects_current, public.workflow_milestones_current from anon;
