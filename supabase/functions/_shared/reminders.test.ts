// Run with: npm test
import { remindersFor, ukNow, DEFAULT_PREFS } from './reminders.ts';
let failures = 0;
const check = (name: string, ok: boolean, detail: unknown = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail !== '' ? ' - ' + JSON.stringify(detail) : ''}`); if (!ok) failures++; };
const kinds = (r: { kind: string }[]) => r.map((x) => x.kind).sort().join(',');

// UK time: BST in summer (UTC+1), GMT in winter.
check('ukNow BST', JSON.stringify(ukNow(new Date('2026-07-01T07:00:00Z'))) === JSON.stringify({ date: '2026-07-01', hour: 8, weekday: 3 }), ukNow(new Date('2026-07-01T07:00:00Z')));
check('ukNow GMT', JSON.stringify(ukNow(new Date('2026-12-01T08:00:00Z'))) === JSON.stringify({ date: '2026-12-01', hour: 8, weekday: 2 }));
check('ukNow late night crosses date', ukNow(new Date('2026-07-01T23:30:00Z')).date === '2026-07-02');

// Thursday 29 Oct 2026.
const base = {
  prefs: DEFAULT_PREFS,
  open: [
    { title: 'Send to accountant', due: '2026-10-29', priority: 'P1', project: 'Accounts' },
    { title: 'Draft copy', due: '2026-10-29', priority: 'P2', project: 'Pricing' },
    { title: 'Kickoff call', due: '2026-10-30', priority: 'P1', project: 'Onboarding' },
    { title: 'Design layout', due: '2026-10-30', priority: 'P2', project: 'Pricing' },
    { title: 'Reconcile bank', due: '2026-10-28', priority: 'P2', project: 'Accounts' },
    { title: 'Old thing', due: '2026-10-20', priority: 'P3', project: 'X' }
  ],
  doneDates: ['2026-10-27', '2026-10-28', '2026-10-15'],
  workoutDates: ['2026-10-20', '2026-10-22'],
  foodDates: ['2026-10-27', '2026-10-28']
};
const thu = (hour: number) => ({ date: '2026-10-29', hour, weekday: 4 });

const at8 = remindersFor(thu(8), base);
check('08:00 due today + P1 tomorrow', kinds(at8) === 'due-today,p1-tomorrow', kinds(at8));
check('due today lists both', at8.find((r) => r.kind === 'due-today')?.body === 'Send to accountant, Draft copy');
check('P1 tomorrow only P1', at8.find((r) => r.kind === 'p1-tomorrow')?.body === 'Kickoff call (Onboarding)');
const at18 = remindersFor(thu(18), base);
check('18:00 Thursday: overdue + no-workout nudge', kinds(at18) === 'no-workout,overdue', kinds(at18));
check('overdue is only what became overdue today', at18.find((r) => r.kind === 'overdue')?.body === 'Reconcile bank');
check('20:00 calories nudge', kinds(remindersFor(thu(20), base)) === 'no-calories');
check('quiet hour sends nothing', remindersFor(thu(11), base).length === 0);

check('no calories nudge once food logged today', remindersFor(thu(20), { ...base, foodDates: [...base.foodDates, '2026-10-29'] }).length === 0);
check('no workout nudge if trained this week', !kinds(remindersFor(thu(18), { ...base, workoutDates: ['2026-10-26'] })).includes('no-workout'));
check('no nudges for non-users', remindersFor(thu(18), { ...base, workoutDates: [], foodDates: [] }).every((r) => r.kind === 'overdue'));
check('nudges can be switched off', kinds(remindersFor(thu(18), { ...base, prefs: { ...DEFAULT_PREFS, nudges: false } })) === 'overdue');
check('daily off keeps P1', kinds(remindersFor(thu(8), { ...base, prefs: { ...DEFAULT_PREFS, daily: false } })) === 'p1-tomorrow');

// Sunday 1 Nov 2026 19:00 weekly summary (week Mon 26 Oct to Sun 1 Nov).
const sun = remindersFor({ date: '2026-11-01', hour: 19, weekday: 7 }, { ...base, workoutDates: ['2026-10-26', '2026-10-28', '2026-10-30', '2026-10-22'] });
const weekly = sun.find((r) => r.kind === 'weekly');
check('weekly summary', weekly?.body === '3 workouts · 2 milestones done · nothing due next week', weekly?.body);
const many = { ...base, open: Array.from({ length: 5 }, (_, i) => ({ title: `T${i}`, due: '2026-10-29', priority: 'P2', project: 'P' })) };
check('long lists are shortened', remindersFor(thu(8), many)[0].body === 'T0, T1, T2 and 2 more');
console.log(failures ? `${failures} FAILED` : 'ALL PASSED');
process.exit(failures ? 1 : 0);
