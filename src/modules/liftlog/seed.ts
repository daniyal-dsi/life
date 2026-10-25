import { addDays, startOfWeek, toISODate } from '@/lib/date';
import { stableId, type Version } from '@/lib/versioned';
import type { ExerciseData, MuscleGroup, SetEntry, TemplateData, WorkoutData } from './types';

// Starter data for a new person: an exercise library, Push/Pull/Legs
// templates, and three weeks of sample workouts with two PRs so the dashboard
// isn't empty. Ids are derived from the user id, so seeding twice is harmless.

const EXERCISES: [string, string, MuscleGroup][] = [
  ['bench', 'Bench press', 'chest'],
  ['incline-db', 'Incline dumbbell press', 'chest'],
  ['squat', 'Squat', 'legs'],
  ['rdl', 'Romanian deadlift', 'legs'],
  ['leg-press', 'Leg press', 'legs'],
  ['deadlift', 'Deadlift', 'back'],
  ['pull-ups', 'Pull-ups', 'back'],
  ['row', 'Barbell row', 'back'],
  ['pulldown', 'Lat pulldown', 'back'],
  ['ohp', 'Overhead press', 'shoulders'],
  ['lateral', 'Lateral raise', 'shoulders'],
  ['curl', 'Barbell curl', 'arms'],
  ['pushdown', 'Tricep pushdown', 'arms'],
  ['cable-crunch', 'Cable crunch', 'core'],
  ['hanging-raise', 'Hanging leg raise', 'core']
];

const TEMPLATES: [string, string, [string, number, number][]][] = [
  ['push', 'Push', [['bench', 3, 8], ['ohp', 3, 8], ['incline-db', 3, 10], ['pushdown', 3, 12], ['lateral', 3, 15]]],
  ['pull', 'Pull', [['deadlift', 3, 5], ['pull-ups', 3, 8], ['row', 3, 8], ['pulldown', 3, 10], ['curl', 3, 10]]],
  ['legs', 'Legs', [['squat', 3, 5], ['rdl', 3, 8], ['leg-press', 3, 10], ['cable-crunch', 3, 15]]]
];

const same = (w: number, r: number, n = 3): SetEntry[] => Array.from({ length: n }, () => ({ w, r }));

const SESSIONS: Record<string, (top: number) => [string, SetEntry[]][]> = {
  push: (bench) => [
    ['bench', [{ w: 80, r: 8 }, { w: bench - 5, r: 5 }, { w: bench, r: 3 }]],
    ['ohp', [{ w: 55, r: 8 }, { w: 55, r: 7 }, { w: 55, r: 6 }]],
    ['incline-db', same(26, 10)],
    ['pushdown', same(32.5, 12)],
    ['lateral', same(10, 15)]
  ],
  pull: (dl) => [
    ['deadlift', [{ w: 140, r: 5 }, { w: dl - 10, r: 3 }, { w: dl, r: 2 }]],
    ['pull-ups', same(10, 8)],
    ['row', same(80, 8)],
    ['pulldown', same(65, 10)],
    ['curl', same(35, 10)]
  ],
  legs: () => [
    ['squat', [{ w: 120, r: 5 }, { w: 130, r: 5 }, { w: 140, r: 3 }]],
    ['rdl', same(100, 8)],
    ['leg-press', same(200, 10)],
    ['cable-crunch', same(40, 15)]
  ]
};

export type Seed = {
  exercises: Version<ExerciseData>[];
  templates: Version<TemplateData>[];
  workouts: Version<WorkoutData>[];
};

export async function buildSeed(userId: string, today = new Date()): Promise<Seed> {
  const now = Date.now();
  const at = (i: number) => new Date(now + i).toISOString();
  const id = (key: string) => stableId(`${userId}:liftlog:${key}`);
  const ex: Record<string, string> = {};
  for (const [slug] of EXERCISES) ex[slug] = await id(`exercise:${slug}`);
  const tpl: Record<string, string> = {};
  for (const [slug] of TEMPLATES) tpl[slug] = await id(`template:${slug}`);

  const exercises = await Promise.all(
    EXERCISES.map(async ([slug, name, group], i) => ({
      id: await id(`exercise:${slug}:v1`),
      entity_id: ex[slug],
      user_id: userId,
      data: { name, group, custom: false },
      deleted: false,
      created_at: at(i)
    }))
  );

  const templates = await Promise.all(
    TEMPLATES.map(async ([slug, name, items], i) => ({
      id: await id(`template:${slug}:v1`),
      entity_id: tpl[slug],
      user_id: userId,
      data: { name, items: items.map(([e, sets, reps]) => ({ exercise_id: ex[e], sets, reps })) },
      deleted: false,
      created_at: at(100 + i)
    }))
  );

  // Push on Monday, Pull on Wednesday, Legs on Friday for the last three
  // weeks, then Push (and Legs if it's past Wednesday) this week. Bench goes
  // 90 -> 92.5 this week and deadlift 165 -> 170 last week: the two PRs.
  const monday = startOfWeek(today);
  const todayIso = toISODate(today);
  const plan: [string, string, number][] = [];
  for (const k of [3, 2, 1]) {
    const mw = addDays(monday, -7 * k);
    plan.push(['push', toISODate(mw), 90]);
    plan.push(['pull', toISODate(addDays(mw, 2)), k === 1 ? 170 : 165]);
    plan.push(['legs', toISODate(addDays(mw, 4)), 0]);
  }
  plan.push(['push', toISODate(monday), 92.5]);
  if (toISODate(addDays(monday, 2)) <= todayIso) plan.push(['legs', toISODate(addDays(monday, 2)), 0]);

  const workouts = await Promise.all(
    plan.map(async ([kind, date, top], i) => ({
      id: await id(`workout:${i}:v1`),
      entity_id: await id(`workout:${i}`),
      user_id: userId,
      data: {
        date,
        note: i === 9 ? 'Felt strong, slept well' : '',
        template_id: tpl[kind],
        sample: true,
        entries: SESSIONS[kind](top).map(([e, sets]) => ({ exercise_id: ex[e], sets }))
      },
      deleted: false,
      created_at: at(200 + i)
    }))
  );

  return { exercises, templates, workouts };
}

