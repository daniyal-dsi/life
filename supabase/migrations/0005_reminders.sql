-- Life Organiser: reminders (Web Push).
--
-- Run once in the Supabase dashboard (SQL Editor > New query > paste > Run),
-- after 0004_workflow.sql. The hourly schedule is set up separately with
-- supabase/setup/schedule_reminders.sql, once the Edge Function is deployed.

-- ---------------------------------------------------------------- push_log
-- One row per reminder sent: what, to whom, for which UK day. The unique key
-- stops the same reminder going out twice if the hourly job runs again.

create table public.push_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  day date not null,
  payload jsonb,
  sent_at timestamptz not null default now(),
  unique (user_id, kind, day)
);
create index push_log_user on public.push_log (user_id, sent_at desc);

alter table public.push_log enable row level security;
-- People can see their own reminder history; only the Edge Function (service role) writes.
create policy "push_log: read own" on public.push_log
  for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------- subscriptions
-- push_subscriptions (from 0001) keeps one row per device. These functions
-- let a device turn reminders on or off; turning off stamps revoked_at
-- rather than deleting the row.

create or replace function public.save_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  if p_endpoint !~ '^https://' or length(p_endpoint) > 1000 then
    raise exception 'Bad push endpoint';
  end if;
  insert into push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (uid, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (user_id, endpoint) do update
    set p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent, revoked_at = null;
end;
$$;

create or replace function public.revoke_push_subscription(p_endpoint text)
returns void
language sql
security definer
set search_path = public
as $$
  update push_subscriptions set revoked_at = now()
  where user_id = auth.uid() and endpoint = p_endpoint and revoked_at is null;
$$;

revoke all on function public.save_push_subscription(text, text, text, text) from public, anon;
revoke all on function public.revoke_push_subscription(text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;
grant execute on function public.revoke_push_subscription(text) to authenticated;
