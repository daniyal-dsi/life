-- Life Organiser: step 5a, Meal Prep library (shared by the household).
--
-- Run once in the Supabase dashboard (SQL Editor > New query > paste > Run),
-- after 0005_reminders.sql.
--
-- Same versioned layout as the personal modules, plus household_id: every
-- member of the household can read and add versions; nobody can update or
-- delete a row. user_id records who saved each version.

-- ---------------------------------------------------------------- tables

create table public.mealprep_ingredients (
  id uuid primary key,
  entity_id uuid not null,
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  deleted boolean not null default false,
  created_at timestamptz not null default now()
);
comment on table public.mealprep_ingredients is
  'Versioned, shared by the household. data: {name, aisle, staple, cooked_per_100g_raw, grams_per: {unit: grams}, nutrition: {kcal, p, c, f} per 100 g cooked, source, source_name, starter?, ask}.';
create index mealprep_ingredients_household on public.mealprep_ingredients (household_id, created_at);
create index mealprep_ingredients_entity on public.mealprep_ingredients (entity_id, created_at desc);

create table public.mealprep_meals (
  id uuid primary key,
  entity_id uuid not null,
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  deleted boolean not null default false,
  created_at timestamptz not null default now()
);
comment on table public.mealprep_meals is
  'Versioned, shared by the household. data: {name, type (breakfast|lunch|dinner), link, lines: [{key, ingredient_id, qty (cooked per portion), unit}]}.';
create index mealprep_meals_household on public.mealprep_meals (household_id, created_at);
create index mealprep_meals_entity on public.mealprep_meals (entity_id, created_at desc);

-- ---------------------------------------------------------------- RLS
-- Shared: current household members read and add. No update or delete.

alter table public.mealprep_ingredients enable row level security;
create policy "mealprep_ingredients: household reads" on public.mealprep_ingredients
  for select to authenticated using (public.is_household_member(household_id));
create policy "mealprep_ingredients: household adds" on public.mealprep_ingredients
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_household_member(household_id));

alter table public.mealprep_meals enable row level security;
create policy "mealprep_meals: household reads" on public.mealprep_meals
  for select to authenticated using (public.is_household_member(household_id));
create policy "mealprep_meals: household adds" on public.mealprep_meals
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_household_member(household_id));

-- ---------------------------------------------------------------- views

create view public.mealprep_ingredients_current with (security_invoker = true) as
select entity_id as ingredient_id, household_id, data ->> 'name' as name, data ->> 'aisle' as aisle,
  coalesce((data ->> 'staple')::boolean, false) as staple, (data ->> 'cooked_per_100g_raw')::numeric as cooked_per_100g_raw,
  (data -> 'nutrition' ->> 'kcal')::numeric as kcal_per_100g, (data -> 'nutrition' ->> 'p')::numeric as protein_per_100g,
  (data -> 'nutrition' ->> 'c')::numeric as carbs_per_100g, (data -> 'nutrition' ->> 'f')::numeric as fat_per_100g,
  data ->> 'source' as source, data ->> 'ask' as needs_type, created_at as updated_at
from (
  select distinct on (entity_id) * from public.mealprep_ingredients order by entity_id, created_at desc, id desc
) latest
where not deleted;

create view public.mealprep_meals_current with (security_invoker = true) as
select entity_id as meal_id, household_id, data ->> 'name' as name, data ->> 'type' as meal_type, data ->> 'link' as link,
  jsonb_array_length(coalesce(data -> 'lines', '[]'::jsonb)) as ingredient_lines, created_at as updated_at
from (
  select distinct on (entity_id) * from public.mealprep_meals order by entity_id, created_at desc, id desc
) latest
where not deleted;

grant select on public.mealprep_ingredients_current, public.mealprep_meals_current to authenticated;
revoke all on public.mealprep_ingredients_current, public.mealprep_meals_current from anon;
