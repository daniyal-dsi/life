// Home's numbers: the glance stats, nudges and the weekly summary. Pure, so
// summary.test.ts runs it under Node; the screen passes in plain data from
// each module's store. Relative .ts imports for the same reason.
import { addDays, fromISODate, startOfWeek, toISODate } from '../../lib/date.ts';

export const STREAK_TARGET = 3;

export type Priority = 'P1' | 'P2' | 'P3';
export type HomeTask = { id: string; title: string; project_id: string; due: string | null; done: boolean; done_at: string | null };
export type HomeProject = { id: string; name: string; priority: Priority; status: string };

export type HomeInput = {
  today: string;
  /** Local hour, 0-23. */
  hour: number;
  lift: { streak: number; workouts: { id: string; date: string; volume: number }[]; prDates: string[] };
  fuel: {
    /** Calorie target in force on a date, or null before the profile is set up. */
    target: (date: string) => number | null;
    /** Calories eaten per date. */
    kcal: Map<string, number>;
    weights: { date: string; kg: number }[];
  };
  work: { tasks: HomeTask[]; projects: HomeProject[] };
};

const iso = (d: Date) => toISODate(d);
const shift = (date: string, n: number) => iso(addDays(fromISODate(date), n));
export const mondayOf = (date: string) => iso(startOfWeek(fromISODate(date)));
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Open tasks in live projects (not Done, not removed). */
function openTasks(w: HomeInput['work']) {
  const live = new Map(w.projects.filter((p) => p.status !== 'Done').map((p) => [p.id, p]));
  return w.tasks.filter((t) => !t.done && live.has(t.project_id)).map((t) => ({ t, p: live.get(t.project_id)! }));
}

/* ---------------------------------------------------------------- glance */

export type Glance = {
  streak: number;
  /** Workouts logged this week (Monday to Sunday). */
  thisWeek: number;
  trainedToday: boolean;
  /** Null before the Fuel Log profile is set up. */
  kcalTarget: number | null;
  kcalEaten: number;
  /** Open P1 tasks due by Sunday, overdue included. */
  p1Week: number;
  open: number;
  dueWeek: number;
};

export function glance(i: HomeInput): Glance {
  const mon = mondayOf(i.today);
  const sun = shift(mon, 6);
  const week = i.lift.workouts.filter((w) => w.date >= mon && w.date <= sun);
  const open = openTasks(i.work);
  return {
    streak: i.lift.streak,
    thisWeek: week.length,
    trainedToday: week.some((w) => w.date === i.today),
    kcalTarget: i.fuel.target(i.today),
    kcalEaten: Math.round(i.fuel.kcal.get(i.today) ?? 0),
    p1Week: open.filter(({ t, p }) => p.priority === 'P1' && t.due && t.due <= sun).length,
    open: open.length,
    dueWeek: open.filter(({ t }) => t.due && t.due >= i.today && t.due <= sun).length
  };
}

/* ---------------------------------------------------------------- nudges */

export type Nudge =
  | { kind: 'workout'; tone: 'sun'; title: string; sub: string }
  | { kind: 'p1'; tone: 'rose'; title: string; sub: string; projectId: string }
  | { kind: 'overdue'; tone: 'rose'; title: string; sub: string }
  | { kind: 'food'; tone: 'green'; title: string; sub: string };

/** Small cards shown only when something needs doing. */
export function nudges(i: HomeInput, relDue: (due: string) => string): Nudge[] {
  const out: Nudge[] = [];
  const g = glance(i);

  if (g.thisWeek < STREAK_TARGET) {
    const left = STREAK_TARGET - g.thisWeek;
    const daysLeft = 7 - ((fromISODate(i.today).getDay() + 6) % 7);
    out.push({
      kind: 'workout',
      tone: 'sun',
      title: `${plural(left, 'more workout')} ${g.streak > 0 ? 'keeps your streak' : 'starts a streak'}`,
      sub: `${g.thisWeek} of ${STREAK_TARGET} logged this week · ${plural(daysLeft, 'day')} left`
    });
  }

  const open = openTasks(i.work);
  const soon = shift(i.today, 3);
  const p1 = open
    .filter(({ t, p }) => p.priority === 'P1' && t.due && t.due <= soon)
    .sort((a, b) => a.t.due!.localeCompare(b.t.due!))[0];
  if (p1)
    out.push({
      kind: 'p1',
      tone: 'rose',
      title: `${p1.t.title} · ${relDue(p1.t.due!).toLowerCase()}`,
      sub: `P1 · ${p1.p.name}`,
      projectId: p1.p.id
    });

  // Overdue work other than the P1 task above.
  const overdue = open.filter(({ t }) => t.due && t.due < i.today && t.id !== p1?.t.id).length;
  if (overdue)
    out.push({
      kind: 'overdue',
      tone: 'rose',
      title: `${plural(overdue, p1 ? 'other task' : 'task')} overdue`,
      sub: 'Tap to see them in Work'
    });

  if (g.kcalTarget !== null && !i.fuel.kcal.get(i.today) && i.hour >= 12)
    out.push({ kind: 'food', tone: 'green', title: 'Nothing logged today', sub: 'Add what you have eaten so far' });

  return out;
}

/* ---------------------------------------------------------------- weekly summary */

export type WeekSummary = {
  start: string;
  end: string;
  /** True for the week now ending (Sunday evening), false for last week. */
  current: boolean;
  workouts: number;
  volume: number;
  prs: number;
  /** Days eaten at or under target, and days with anything logged. */
  onTarget: number;
  logged: number;
  done: number;
  /** Open now. */
  open: number;
  weightChange: number | null;
  /** The most important open task due the week after (from today on): P1 first, then soonest. */
  nextBig: { title: string; project: string; projectId: string; priority: Priority; due: string } | null;
};

/** The week just finished; from 18:00 on Sunday, the week now ending. */
export function weekSummary(i: HomeInput): WeekSummary {
  const sundayEvening = fromISODate(i.today).getDay() === 0 && i.hour >= 18;
  const start = sundayEvening ? mondayOf(i.today) : shift(mondayOf(i.today), -7);
  const end = shift(start, 6);
  const inWeek = (d: string | null) => !!d && d >= start && d <= end;

  const ws = i.lift.workouts.filter((w) => inWeek(w.date));
  let onTarget = 0;
  let logged = 0;
  for (let n = 0; n < 7; n++) {
    const d = shift(start, n);
    const k = i.fuel.kcal.get(d);
    if (!k) continue;
    logged++;
    const t = i.fuel.target(d);
    if (t !== null && k <= t) onTarget++;
  }

  const sorted = [...i.fuel.weights].sort((a, b) => a.date.localeCompare(b.date));
  const atEnd = sorted.filter((w) => w.date <= end).pop();
  const before = sorted.filter((w) => w.date < start).pop();
  const weightChange = atEnd && before && atEnd !== before ? Math.round((atEnd.kg - before.kg) * 10) / 10 : null;

  // The week after the summary: the coming week on Sunday evening, otherwise
  // the current one (from today on; overdue work has its own nudge).
  const nStart = [shift(end, 1), i.today].sort()[1];
  const nEnd = shift(end, 7);
  const rank: Record<Priority, number> = { P1: 0, P2: 1, P3: 2 };
  const next = openTasks(i.work)
    .filter(({ t }) => t.due && t.due >= nStart && t.due <= nEnd)
    .sort((a, b) => rank[a.p.priority] - rank[b.p.priority] || a.t.due!.localeCompare(b.t.due!))[0];

  const projectIds = new Set(i.work.projects.map((p) => p.id));
  return {
    start,
    end,
    current: sundayEvening,
    workouts: ws.length,
    volume: Math.round(ws.reduce((s, w) => s + w.volume, 0)),
    prs: i.lift.prDates.filter(inWeek).length,
    onTarget,
    logged,
    done: i.work.tasks.filter((t) => t.done && inWeek(t.done_at) && projectIds.has(t.project_id)).length,
    open: openTasks(i.work).length,
    weightChange,
    nextBig: next ? { title: next.t.title, project: next.p.name, projectId: next.p.id, priority: next.p.priority, due: next.t.due! } : null
  };
}
