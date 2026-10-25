-- Life Organiser: step 1 foundations.
--
-- Two people, each with their own login and personal rows (user_id), sharing
-- one household (household_id). Row-level security is on for every table.
--
-- Records are dated and kept, never overwritten: tables get SELECT and INSERT
-- policies only, so the app cannot UPDATE or DELETE rows. Settings changes add
-- a new row and the newest row wins. Leaving a household stamps left_at on the
-- membership instead of deleting it.
--
-- Run once in the Supabase dashboard: SQL Editor > New query > paste > Run.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- tables

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);
comment on table public.profiles is 'One row per signed-up user, created by a trigger on auth.users.';

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  invite_code text not null unique check (invite_code ~ '^[A-Z2-9]{6}$'),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  check (left_at is null or left_at >= joined_at)
);
-- A person belongs to at most one household at a time.
create unique index household_members_one_active on public.household_members (user_id) where left_at is null;
create index household_members_household on public.household_members (household_id) where left_at is null;

create table public.settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  created_at timestamptz not null default now()
);
comment on table public.settings is 'Append-only. The newest row per user is the current settings.';
create index settings_user_created on public.settings (user_id, created_at desc);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (user_id, endpoint)
);
comment on table public.push_subscriptions is 'Web Push subscriptions, one per device. Used from a later step.';

create table public.inbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 10000),
  source text not null default 'app',
  used_for text,
  created_at timestamptz not null default now()
);
comment on table public.inbox is 'Messages sent in from outside the app (e.g. the iPhone Shortcut).';
create index inbox_user_created on public.inbox (user_id, created_at desc);

-- ---------------------------------------------------------------- helpers
-- SECURITY DEFINER so policies can check membership without recursing into
-- household_members' own policy.

create or replace function public.is_household_member(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.household_members
    where household_id = hid and user_id = auth.uid() and left_at is null
  );
$$;

create or replace function public.shares_household_with(other uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.household_members mine
    join public.household_members theirs on theirs.household_id = mine.household_id
    where mine.user_id = auth.uid() and mine.left_at is null
      and theirs.user_id = other and theirs.left_at is null
  );
$$;

create or replace function public.generate_invite_code()
returns text
language plpgsql
volatile
set search_path = public, extensions
as $$
declare
  -- 32 characters without 0/O/1/I, so each random byte maps evenly.
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  bytes bytea;
begin
  loop
    bytes := gen_random_bytes(6);
    code := '';
    for i in 0..5 loop
      code := code || substr(alphabet, 1 + (get_byte(bytes, i) % 32), 1);
    end loop;
    exit when not exists (select 1 from public.households where invite_code = code);
  end loop;
  return code;
end;
$$;

-- New sign-ups get a profile row.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Anyone who signed up before this migration ran.
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;

-- ---------------------------------------------------------------- RPCs

-- Start a household and become its owner.
create or replace function public.create_household(p_name text default 'Our household')
returns public.households
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  h public.households;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  if exists (select 1 from household_members where user_id = uid and left_at is null) then
    raise exception 'You are already in a household' using errcode = 'P0001';
  end if;

  insert into households (name, invite_code, created_by)
  values (coalesce(nullif(trim(p_name), ''), 'Our household'), generate_invite_code(), uid)
  returning * into h;

  insert into household_members (household_id, user_id, role) values (h.id, uid, 'owner');
  return h;
end;
$$;

-- Join a household with its invite code. If you are in another household you
-- leave it (left_at is stamped; nothing is deleted).
create or replace function public.join_household(p_code text)
returns public.households
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  h public.households;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  select * into h from households
  where invite_code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  if not found then
    raise exception 'Invite code not found' using errcode = 'P0002';
  end if;

  if exists (select 1 from household_members where household_id = h.id and user_id = uid and left_at is null) then
    return h;
  end if;

  update household_members set left_at = now() where user_id = uid and left_at is null;
  insert into household_members (household_id, user_id, role) values (h.id, uid, 'member');
  return h;
end;
$$;

-- Members of your household, with each person's current display name (from
-- their newest settings row).
create or replace function public.household_roster()
returns table (user_id uuid, email text, display_name text, role text, joined_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.user_id,
    p.email,
    nullif((
      select s.data ->> 'name' from settings s
      where s.user_id = m.user_id
      order by s.created_at desc
      limit 1
    ), ''),
    m.role,
    m.joined_at
  from household_members m
  left join profiles p on p.id = m.user_id
  where m.left_at is null
    and m.household_id in (
      select household_id from household_members where user_id = auth.uid() and left_at is null
    )
  order by m.joined_at;
$$;

revoke all on function public.is_household_member(uuid) from public, anon;
revoke all on function public.shares_household_with(uuid) from public, anon;
revoke all on function public.generate_invite_code() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.create_household(text) from public, anon;
revoke all on function public.join_household(text) from public, anon;
revoke all on function public.household_roster() from public, anon;
grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.shares_household_with(uuid) to authenticated;
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.join_household(text) to authenticated;
grant execute on function public.household_roster() to authenticated;

-- ---------------------------------------------------------------- RLS

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.settings enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.inbox enable row level security;

-- Profiles: yourself and people in your household. Rows come from the trigger.
create policy "profiles: read own and household" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.shares_household_with(id));

-- Households and memberships: members only. Writes go through the RPCs.
create policy "households: members read" on public.households
  for select to authenticated
  using (public.is_household_member(id));

create policy "household_members: members read" on public.household_members
  for select to authenticated
  using (user_id = auth.uid() or public.is_household_member(household_id));

-- Personal tables: owner only, read and add.
create policy "settings: read own" on public.settings
  for select to authenticated using (user_id = auth.uid());
create policy "settings: add own" on public.settings
  for insert to authenticated with check (user_id = auth.uid());

create policy "push_subscriptions: read own" on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid());
create policy "push_subscriptions: add own" on public.push_subscriptions
  for insert to authenticated with check (user_id = auth.uid());

create policy "inbox: read own" on public.inbox
  for select to authenticated using (user_id = auth.uid());
create policy "inbox: add own" on public.inbox
  for insert to authenticated with check (user_id = auth.uid());
