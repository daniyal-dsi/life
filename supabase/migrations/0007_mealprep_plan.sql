-- Life Organiser: step 5b, Meal Prep week plan and shopping list (shared).
--
-- Run once in the Supabase dashboard (SQL Editor > New query > paste > Run),
-- after 0006_mealprep_library.sql. Same shared, versioned layout as 0006.

-- ---------------------------------------------------------------- tables

create table public.mealprep_plan (
  id uuid primary key,
  entity_id uuid not null,
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  deleted boolean not null default false,
  created_at timestamptz not null default now()
);
comment on table public.mealprep_plan is
  'Versioned, shared by the household. One entity per date and slot. data: {date, slot (breakfast|lunch|dinner), meal_id, eaters: [user ids]}.';
create index mealprep_plan_household on public.mealprep_plan (household_id, created_at);
create index mealprep_plan_entity on public.mealprep_plan (entity_id, created_at desc);

alter table public.mealprep_plan enable row level security;
create policy "mealprep_plan: household reads" on public.mealprep_plan
  for select to authenticated using (public.is_household_member(household_id));
create policy "mealprep_plan: household adds" on public.mealprep_plan
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_household_member(household_id));

create table public.mealprep_shopping (
  id uuid primary key,
  entity_id uuid not null,
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  deleted boolean not null default false,
  created_at timestamptz not null default now()
);
comment on table public.mealprep_shopping is
  'Versioned, shared by the household. data: {week (Monday), kind: item {ingredient_id, done, amount} or extra {name, done}}.';
create index mealprep_shopping_household on public.mealprep_shopping (household_id, created_at);
create index mealprep_shopping_entity on public.mealprep_shopping (entity_id, created_at desc);

alter table public.mealprep_shopping enable row level security;
create policy "mealprep_shopping: household reads" on public.mealprep_shopping
  for select to authenticated using (public.is_household_member(household_id));
create policy "mealprep_shopping: household adds" on public.mealprep_shopping
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_household_member(household_id));

-- ---------------------------------------------------------------- view

create view public.mealprep_plan_current with (security_invoker = true) as
select entity_id as plan_id, household_id, (data ->> 'date')::date as plan_date, data ->> 'slot' as slot,
  (data ->> 'meal_id')::uuid as meal_id, jsonb_array_length(coalesce(data -> 'eaters', '[]'::jsonb)) as portions,
  created_at as updated_at
from (
  select distinct on (entity_id) * from public.mealprep_plan order by entity_id, created_at desc, id desc
) latest
where not deleted;

grant select on public.mealprep_plan_current to authenticated;
revoke all on public.mealprep_plan_current from anon;
