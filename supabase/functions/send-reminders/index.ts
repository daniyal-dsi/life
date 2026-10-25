// Sends reminder notifications. Two ways in:
//   - Hourly schedule (pg_cron, see supabase/setup/schedule_reminders.sql):
//     POST with header x-cron-secret = CRON_SECRET. Works out each person's
//     reminders for this UK hour and sends them once (push_log stops repeats).
//   - "Send a test" in the app: POST {"test": true} with the person's own
//     sign-in token. Sends one test notification to their devices.
//
// Secrets (Supabase > Edge Functions > Secrets): VAPID_PUBLIC_KEY,
// VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...), CRON_SECRET.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { DEFAULT_PREFS, addDays, remindersFor, ukNow, type OpenMilestone, type Reminder, type ReminderPrefs } from '../_shared/reminders.ts';
import { sendPush, type VapidKeys } from '../_shared/webpush.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const env = (k: string) => Deno.env.get(k) ?? '';

type Sub = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const vapid: VapidKeys = { publicKey: env('VAPID_PUBLIC_KEY'), privateKey: env('VAPID_PRIVATE_KEY'), subject: env('VAPID_SUBJECT') };
  if (!vapid.publicKey || !vapid.privateKey || !vapid.subject) return json({ error: 'VAPID secrets are not set' }, 500);
  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  const body = await req.json().catch(() => ({}));

  // Test from the app: authenticate the person by their own token.
  if (body?.test) {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data } = await admin.auth.getUser(token);
    if (!data.user) return json({ error: 'Sign in first' }, 401);
    const subs = await activeSubs(admin, [data.user.id]);
    if (!subs.length) return json({ error: 'No devices have reminders turned on' }, 400);
    const results = await deliver(admin, subs, { kind: 'test', title: 'Reminders are on', body: "You'll get your Life Organiser reminders on this device.", url: '/more' }, vapid);
    return json({ sent: results.filter((r) => r.ok).length, devices: subs.length });
  }

  // Scheduled run.
  const secret = env('CRON_SECRET');
  if (!secret || req.headers.get('x-cron-secret') !== secret) return json({ error: 'Unauthorised' }, 401);
  const now = ukNow(body?.at ? new Date(body.at) : new Date());

  const subs = await activeSubs(admin);
  const userIds = [...new Set(subs.map((s) => s.user_id))];
  if (!userIds.length) return json({ now, users: 0, sent: 0 });

  const data = await loadPeople(admin, userIds, now.date);
  let sent = 0;
  const log: unknown[] = [];
  for (const userId of userIds) {
    for (const r of remindersFor(now, data(userId))) {
      // One of each kind per person per day, even if the job runs twice.
      const { error } = await admin.from('push_log').insert({ user_id: userId, kind: r.kind, day: now.date, payload: r });
      if (error) {
        if (error.code === '23505') continue; // already sent
        throw error;
      }
      const results = await deliver(admin, subs.filter((s) => s.user_id === userId), r, vapid);
      sent += results.filter((x) => x.ok).length;
      log.push({ kind: r.kind, devices: results.length, ok: results.filter((x) => x.ok).length });
    }
  }
  return json({ now, users: userIds.length, sent, log });
});

async function activeSubs(admin: SupabaseClient, userIds?: string[]): Promise<Sub[]> {
  let q = admin.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth').is('revoked_at', null);
  if (userIds) q = q.in('user_id', userIds);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Sub[];
}

/** Sends to each device; devices the push service says are gone get revoked_at stamped. */
async function deliver(admin: SupabaseClient, subs: Sub[], r: Reminder, vapid: VapidKeys) {
  const payload = { title: r.title, body: r.body, url: r.url, tag: r.kind };
  const results = await Promise.all(
    subs.map(async (s) => {
      try {
        const res = await sendPush(s, payload, vapid);
        if (res.gone) await admin.from('push_subscriptions').update({ revoked_at: new Date().toISOString() }).eq('id', s.id);
        return res;
      } catch (err) {
        return { ok: false, status: 0, gone: false, body: String(err) };
      }
    })
  );
  return results;
}

/** Loads what the reminder rules need for everyone with reminders on. */
async function loadPeople(admin: SupabaseClient, userIds: string[], today: string) {
  const since = addDays(today, -35);
  const [settings, milestones, projects, workouts, food] = await Promise.all([
    admin.from('settings').select('user_id, data, created_at').in('user_id', userIds).order('created_at', { ascending: false }),
    admin.from('workflow_milestones_current').select('user_id, project_id, title, due, done, done_at, sample').in('user_id', userIds),
    admin.from('workflow_projects_current').select('project_id, name, priority').in('user_id', userIds),
    admin.from('liftlog_workouts_current').select('user_id, workout_date, data').in('user_id', userIds).gte('workout_date', since),
    admin.from('fuellog_entries_current').select('user_id, entry_date, sample').in('user_id', userIds).gte('entry_date', addDays(today, -8))
  ]);
  for (const r of [settings, milestones, projects, workouts, food]) if (r.error) throw r.error;

  const prefs = new Map<string, ReminderPrefs>();
  for (const s of settings.data ?? []) {
    if (!prefs.has(s.user_id)) prefs.set(s.user_id, { ...DEFAULT_PREFS, ...(s.data?.reminders ?? {}) });
  }
  const projectById = new Map((projects.data ?? []).map((p) => [p.project_id, p]));

  // Sample data never triggers reminders.
  return (userId: string) => {
    const ms = (milestones.data ?? []).filter((m) => m.user_id === userId && !m.sample && projectById.has(m.project_id));
    const open: OpenMilestone[] = ms
      .filter((m) => !m.done)
      .map((m) => ({ title: m.title, due: m.due, priority: projectById.get(m.project_id)!.priority, project: projectById.get(m.project_id)!.name }));
    return {
      prefs: prefs.get(userId) ?? DEFAULT_PREFS,
      open,
      doneDates: ms.filter((m) => m.done && m.done_at).map((m) => m.done_at as string),
      workoutDates: (workouts.data ?? []).filter((w) => w.user_id === userId && !w.data?.sample).map((w) => w.workout_date),
      foodDates: (food.data ?? []).filter((f) => f.user_id === userId && !f.sample).map((f) => f.entry_date)
    };
  };
}
