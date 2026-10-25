import { addDays, fromISODate, startOfWeek, toISODate } from '@/lib/date';
import { PRIORITIES, type Bucket, type Milestone, type Priority, type Project } from './types';

// Derived numbers for the overview, bucket and project screens.

export type Ctx = { today: string; weekEnd: string; soon: string; nextWeek: string };

export function dateCtx(today: string): Ctx {
  const d = fromISODate(today);
  return {
    today,
    weekEnd: toISODate(addDays(startOfWeek(d), 6)),
    soon: toISODate(addDays(d, 3)),
    nextWeek: toISODate(addDays(d, 7))
  };
}

export const byOrder = (a: Milestone, b: Milestone) => a.order - b.order || a.created_at.localeCompare(b.created_at);

export function projectStats(p: Project, milestones: Milestone[]) {
  const ms = milestones.filter((m) => m.project_id === p.id).sort(byOrder);
  const done = ms.filter((m) => m.done).length;
  return { ms, done, total: ms.length, pct: ms.length ? done / ms.length : 0, next: ms.find((m) => !m.done) ?? null };
}

export function bucketStats(b: Bucket, projects: Project[], milestones: Milestone[]) {
  const ps = projects.filter((p) => p.bucket_id === b.id);
  const ids = new Set(ps.map((p) => p.id));
  const ms = milestones.filter((m) => ids.has(m.project_id));
  const open = ms.filter((m) => !m.done);
  const prio = new Map(ps.map((p) => [p.id, p.priority]));
  return {
    projects: ps,
    active: ps.filter((p) => p.status !== 'Done').length,
    total: ms.length,
    open: open.length,
    p1: ps.filter((p) => p.priority === 'P1' && p.status !== 'Done').length,
    p1Open: open.filter((m) => prio.get(m.project_id) === 'P1').length,
    pct: ms.length ? (ms.length - open.length) / ms.length : 0,
    next: open.map((m) => m.due).filter((d): d is string => !!d).sort()[0] ?? null
  };
}

export function overview(projects: Project[], milestones: Milestone[], c: Ctx) {
  const prio = new Map(projects.map((p) => [p.id, p.priority]));
  const live = new Set(projects.map((p) => p.id));
  const all = milestones.filter((m) => live.has(m.project_id));
  const open = all.filter((m) => !m.done);
  return {
    activeProjects: projects.filter((p) => p.status !== 'Done').length,
    p1Projects: projects.filter((p) => p.priority === 'P1' && p.status !== 'Done').length,
    open: open.length,
    dueWeek: open.filter((m) => m.due && m.due >= c.today && m.due <= c.weekEnd).length,
    dueToday: open.filter((m) => m.due === c.today),
    overdue: open.filter((m) => m.due && m.due < c.today),
    done: all.filter((m) => m.done),
    /** Anything overdue or due in the next 3 days, plus P1 work due within a week. */
    attention: open
      .filter((m) => (m.due && m.due <= c.soon) || (prio.get(m.project_id) === 'P1' && (!m.due || m.due <= c.nextWeek)))
      .sort((a, b) => sortByDue(a, b, prio))
  };
}

export function sortByDue(a: Milestone, b: Milestone, prio: Map<string, Priority>): number {
  const da = a.due ?? '9999';
  const db = b.due ?? '9999';
  if (da !== db) return da < db ? -1 : 1;
  return PRIORITIES.indexOf(prio.get(a.project_id) ?? 'P3') - PRIORITIES.indexOf(prio.get(b.project_id) ?? 'P3');
}

/** "Today", "Tomorrow", "3 days late", "Thu", "12 Nov". */
export function relDue(due: string | null, today: string): string {
  if (!due) return 'No date';
  const n = Math.round((fromISODate(due).getTime() - fromISODate(today).getTime()) / 864e5);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  if (n < 0) return `${-n} days late`;
  if (n < 7) return fromISODate(due).toLocaleDateString('en-GB', { weekday: 'short' });
  return fromISODate(due).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** "Done today", "Done yesterday", "Done 17 Oct". */
export function doneLabel(doneAt: string | null, today: string): string {
  if (!doneAt) return 'Done';
  if (doneAt === today) return 'Done today';
  const n = Math.round((fromISODate(today).getTime() - fromISODate(doneAt).getTime()) / 864e5);
  if (n === 1) return 'Done yesterday';
  return `Done ${fromISODate(doneAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
}

export type DueState = 'late' | 'today' | 'none';
export function dueState(m: { due: string | null; done: boolean }, today: string): DueState {
  if (m.done || !m.due) return 'none';
  return m.due < today ? 'late' : m.due === today ? 'today' : 'none';
}
