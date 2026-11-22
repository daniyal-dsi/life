// Home glance, nudges and weekly summary. Run with: npm test
import { glance, mondayOf, nudges, weekSummary, type HomeInput } from './summary.ts';

let failures = 0;
const check = (name: string, ok: boolean, detail: unknown = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail !== '' ? ` - ${JSON.stringify(detail)}` : ''}`);
  if (!ok) failures++;
};

// Wednesday 18 November 2026; the week runs Mon 16 to Sun 22.
const TODAY = '2026-11-18';
const base = (over: Partial<HomeInput> = {}): HomeInput => ({
  today: TODAY,
  hour: 9,
  lift: { streak: 2, workouts: [], prDates: [] },
  fuel: { target: () => 2000, kcal: new Map(), weights: [] },
  work: { tasks: [], projects: [] },
  ...over
});
const rel = (d: string) => d;

check('mondayOf', mondayOf(TODAY) === '2026-11-16' && mondayOf('2026-11-22') === '2026-11-16' && mondayOf('2026-11-23') === '2026-11-23');

// Glance.
const lift = {
  streak: 4,
  workouts: [
    { id: 'a', date: '2026-11-09', volume: 5000 },
    { id: 'b', date: '2026-11-12', volume: 4000 },
    { id: 'c', date: '2026-11-16', volume: 6000 },
    { id: 'd', date: TODAY, volume: 3000 }
  ],
  prDates: ['2026-11-12', '2026-11-16']
};
const projects = [
  { id: 'p1', name: 'Accounts', priority: 'P1' as const, status: 'In progress' },
  { id: 'p2', name: 'Site', priority: 'P2' as const, status: 'Planning' },
  { id: 'pd', name: 'Old', priority: 'P1' as const, status: 'Done' }
];
const task = (id: string, project_id: string, due: string | null, done = false, done_at: string | null = null) => ({ id, title: id, project_id, due, done, done_at });
const tasks = [
  task('late-p1', 'p1', '2026-11-15'),
  task('fri-p1', 'p1', '2026-11-20'),
  task('next-p1', 'p1', '2026-11-25'),
  task('late-p2', 'p2', '2026-11-10'),
  task('wed-p2', 'p2', TODAY),
  task('next-p2', 'p2', '2026-11-24'),
  task('dead', 'pd', '2026-11-01'),
  task('done-last', 'p2', '2026-11-11', true, '2026-11-11'),
  task('done-now', 'p2', null, true, '2026-11-17')
];
const g = glance(base({ lift, fuel: { target: () => 2000, kcal: new Map([[TODAY, 1250.4]]), weights: [] }, work: { tasks, projects } }));
check('glance: workouts this week', g.thisWeek === 2 && g.trainedToday, g);
check('glance: kcal eaten and target', g.kcalEaten === 1250 && g.kcalTarget === 2000);
check('glance: P1 due this week includes overdue, not next week or Done projects', g.p1Week === 2, g.p1Week);
check('glance: open tasks skip Done projects', g.open === 6, g.open);
check('glance: due this week from today', g.dueWeek === 2, g.dueWeek);
check('glance: no profile gives a null target', glance(base({ fuel: { target: () => null, kcal: new Map(), weights: [] } })).kcalTarget === null);

// Nudges.
const n = nudges(base({ hour: 13, lift, work: { tasks, projects } }), rel);
check('nudge: one more workout keeps the streak', n[0]?.kind === 'workout' && n[0].title === '1 more workout keeps your streak' && n[0].sub.endsWith('5 days left'), n[0]);
check('nudge: earliest P1 within 3 days, overdue first', n.some((x) => x.kind === 'p1' && x.title.startsWith('late-p1') && x.projectId === 'p1'), n);
check('nudge: other overdue tasks counted once', n.some((x) => x.kind === 'overdue' && x.title === '1 other task overdue'), n);
check('nudge: nothing logged after midday', n.some((x) => x.kind === 'food'));
check('no food nudge in the morning', !nudges(base({ hour: 11 }), rel).some((x) => x.kind === 'food'));
check('no food nudge without a profile', !nudges(base({ hour: 14, fuel: { target: () => null, kcal: new Map(), weights: [] } }), rel).some((x) => x.kind === 'food'));
const full = nudges(base({ hour: 14, lift: { ...lift, workouts: [...lift.workouts, { id: 'e', date: '2026-11-17', volume: 1 }] }, fuel: { target: () => 2000, kcal: new Map([[TODAY, 500]]), weights: [] } }), rel);
check('all clear when trained 3 times, logged and nothing due', full.length === 0, full);
check('streak of 0 says "starts a streak"', nudges(base({ lift: { streak: 0, workouts: [], prDates: [] } }), rel)[0].title === '3 more workouts starts a streak');

// Weekly summary: last week is Mon 9 to Sun 15.
const kcal = new Map([
  ['2026-11-09', 1900],
  ['2026-11-10', 2300],
  ['2026-11-11', 2000],
  ['2026-11-16', 1000]
]);
const weights = [
  { date: '2026-11-01', kg: 82.5 },
  { date: '2026-11-14', kg: 81.9 },
  { date: '2026-11-17', kg: 81 }
];
const w = weekSummary(base({ lift, fuel: { target: () => 2000, kcal, weights }, work: { tasks, projects } }));
check('summary: last week on a Wednesday', w.start === '2026-11-09' && w.end === '2026-11-15' && !w.current, w);
check('summary: workouts, volume and PRs', w.workouts === 2 && w.volume === 9000 && w.prs === 1, w);
check('summary: days on target and logged', w.onTarget === 2 && w.logged === 3, w);
check('summary: tasks done that week and open now', w.done === 1 && w.open === 6, w);
check('summary: weight change across the week', w.weightChange === -0.6, w.weightChange);
check('summary: biggest item is the P1 one due this week (from last week, "next" is this week)', w.nextBig?.title === 'fri-p1', w.nextBig);
const lateOnly = weekSummary(base({ work: { tasks: [task('late-p1', 'p1', '2026-11-17'), task('sat-p2', 'p2', '2026-11-21')], projects } }));
check('summary: overdue work is not the biggest item', lateOnly.nextBig?.title === 'sat-p2', lateOnly.nextBig);

const sun = weekSummary(base({ today: '2026-11-22', hour: 19, lift, fuel: { target: () => 2000, kcal, weights }, work: { tasks, projects } }));
check('summary: Sunday evening shows the week now ending', sun.start === '2026-11-16' && sun.current && sun.workouts === 2 && sun.prs === 1, sun);
check('summary: Sunday evening, next week is the coming one', sun.nextBig?.title === 'next-p1' && sun.done === 1, sun.nextBig);
check('summary: Sunday afternoon still shows last week', weekSummary(base({ today: '2026-11-22', hour: 15 })).start === '2026-11-09');
check('summary: no weight change without a weigh-in before the week', weekSummary(base({ fuel: { target: () => 2000, kcal, weights: [{ date: '2026-11-12', kg: 80 }] } })).weightChange === null);

if (failures) {
  console.error(`\n${failures} home check(s) failed`);
  process.exit(1);
}
console.log('\nAll home checks passed');
