// Decides which reminders a person gets in a given hour (UK time). Pure
// logic with no I/O, so it is tested in Node and reused by the Edge Function.

export type ReminderPrefs = { daily: boolean; p1: boolean; overdue: boolean; weekly: boolean; nudges: boolean };
export const DEFAULT_PREFS: ReminderPrefs = { daily: true, p1: true, overdue: true, weekly: true, nudges: true };

/** UK wall-clock time: date YYYY-MM-DD, hour 0-23, weekday 1 (Mon) to 7 (Sun). */
export type UkNow = { date: string; hour: number; weekday: number };

export type OpenMilestone = { title: string; due: string | null; priority: 'P1' | 'P2' | 'P3'; project: string };
export type PersonData = {
  prefs: ReminderPrefs;
  open: OpenMilestone[];
  /** Dates (YYYY-MM-DD) milestones were completed. */
  doneDates: string[];
  workoutDates: string[];
  foodDates: string[];
};

export type Reminder = { kind: string; title: string; body: string; url: string };

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function ukNow(at: Date): UkNow {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
      weekday: 'short'
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value])
  );
  const weekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(parts.weekday) + 1;
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour), weekday };
}

function list(titles: string[]): string {
  if (titles.length <= 3) return titles.join(', ');
  return `${titles.slice(0, 3).join(', ')} and ${titles.length - 3} more`;
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

export function remindersFor(now: UkNow, p: PersonData): Reminder[] {
  const out: Reminder[] = [];
  const yesterday = addDays(now.date, -1);
  const tomorrow = addDays(now.date, 1);
  const monday = addDays(now.date, -(now.weekday - 1));
  const inWeek = (d: string) => d >= monday && d <= now.date;

  if (now.hour === 8) {
    const today = p.open.filter((m) => m.due === now.date);
    if (p.prefs.daily && today.length) {
      out.push({
        kind: 'due-today',
        title: today.length === 1 ? 'Due today' : `${today.length} milestones due today`,
        body: list(today.map((m) => m.title)),
        url: '/work'
      });
    }
    const p1 = p.open.filter((m) => m.priority === 'P1' && m.due === tomorrow);
    if (p.prefs.p1 && p1.length) {
      out.push({
        kind: 'p1-tomorrow',
        title: p1.length === 1 ? 'P1 due tomorrow' : `${p1.length} P1 milestones due tomorrow`,
        body: list(p1.map((m) => `${m.title} (${m.project})`)),
        url: '/work'
      });
    }
  }

  // "Anything that became overdue today": due yesterday and still open.
  if (now.hour === 18) {
    const late = p.open.filter((m) => m.due === yesterday);
    if (p.prefs.overdue && late.length) {
      out.push({
        kind: 'overdue',
        title: late.length === 1 ? 'Now overdue' : `${late.length} milestones now overdue`,
        body: list(late.map((m) => m.title)),
        url: '/work'
      });
    }
  }

  // Nudges, only for people who use the module recently.
  if (p.prefs.nudges) {
    const recentLifter = p.workoutDates.some((d) => d >= addDays(now.date, -28));
    if (now.weekday === 4 && now.hour === 18 && recentLifter && !p.workoutDates.some(inWeek)) {
      out.push({ kind: 'no-workout', title: 'No workout yet this week', body: 'Three workouts keeps your streak going.', url: '/health?m=lift' });
    }
    const recentLogger = p.foodDates.some((d) => d >= addDays(now.date, -7) && d < now.date);
    if (now.hour === 20 && recentLogger && !p.foodDates.includes(now.date)) {
      out.push({ kind: 'no-calories', title: 'Calories not logged today', body: 'Log what you ate to keep your target on track.', url: '/health?m=fuel' });
    }
  }

  if (now.weekday === 7 && now.hour === 19 && p.prefs.weekly) {
    const workouts = p.workoutDates.filter(inWeek).length;
    const done = p.doneDates.filter(inWeek).length;
    const nextWeek = p.open.filter((m) => m.due && m.due > now.date && m.due <= addDays(now.date, 7));
    const p1Next = nextWeek.filter((m) => m.priority === 'P1').length;
    const parts = [
      plural(workouts, 'workout'),
      `${plural(done, 'milestone')} done`,
      nextWeek.length ? `${nextWeek.length} due next week${p1Next ? ` (${p1Next} P1)` : ''}` : 'nothing due next week'
    ];
    out.push({ kind: 'weekly', title: 'Your week', body: parts.join(' · '), url: '/' });
  }

  return out;
}
