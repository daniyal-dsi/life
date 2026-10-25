-- Hourly reminder schedule. Run once in the Supabase SQL Editor, AFTER:
--   1. 0005_reminders.sql has run,
--   2. the send-reminders Edge Function is deployed, and
--   3. CRON_SECRET is set in Supabase > Edge Functions > Secrets.
--
-- Before running, replace the two placeholders below:
--   YOUR-PROJECT-REF  -> the part before .supabase.co in your Project URL
--   YOUR-CRON-SECRET  -> the same value you saved as CRON_SECRET
-- Both are stored in Supabase Vault (encrypted), not in this file or the repo.
-- Don't commit this file with real values filled in.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret('https://YOUR-PROJECT-REF.supabase.co', 'reminders_project_url');
select vault.create_secret('YOUR-CRON-SECRET', 'reminders_cron_secret');

-- At minute 0 of every hour. The function works out UK time itself.
select cron.schedule(
  'send-reminders-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'reminders_project_url') || '/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'reminders_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

-- To check it later:
--   select * from cron.job;                                   -- the schedule
--   select * from cron.job_run_details order by start_time desc limit 5;
--   select * from net._http_response order by created desc limit 5;  -- function replies
--   select * from public.push_log order by sent_at desc limit 20;     -- reminders sent
-- To stop it:
--   select cron.unschedule('send-reminders-hourly');
