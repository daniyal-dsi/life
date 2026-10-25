import { addDays, fromISODate, startOfWeek, toISODate } from '@/lib/date';
import type { Exercise, MuscleGroup, SetEntry, Workout } from './types';

// Derived numbers: PRs, streak, volumes. Nothing here is stored; it is all
// worked out from the logged workouts, so editing a workout re-scores it.

export type PR = { workoutId: string; date: string; exerciseId: string; w: number; r: number; prev: number };
export type Best = { w: number; r: number; date: string; workoutId: string };

export type LiftStats = {
  /** Oldest first. */
  workouts: Workout[];
  best: Record<string, Best>;
  /** Keys "workoutId|exerciseId|setIndex" of sets that set a PR. */
  prSets: Set<string>;
  prs: PR[];
  thisWeek: Workout[];
  weekStart: string;
  streak: number;
  bestStreak: number;
  month: Workout[];
  monthVolume: number;
  volumeByGroup: Partial<Record<MuscleGroup, number>>;
  weekVolume: number;
};

export const STREAK_TARGET = 3;

export function sortWorkouts(a: Workout, b: Workout): number {
  return a.date === b.date ? a.created_at.localeCompare(b.created_at) : a.date < b.date ? -1 : 1;
}

export function workoutVolume(w: Workout): number {
  return w.entries.reduce((sum, e) => sum + e.sets.reduce((s, x) => s + x.w * x.r, 0), 0);
}

/** Index of the heaviest set (more reps breaks a tie), or -1. */
export function topSetIndex(sets: SetEntry[]): number {
  let mi = -1;
  sets.forEach((s, i) => {
    if (mi < 0 || s.w > sets[mi].w || (s.w === sets[mi].w && s.r > sets[mi].r)) mi = i;
  });
  return mi;
}

const weekOf = (iso: string) => toISODate(startOfWeek(fromISODate(iso)));

export function liftStats(all: Workout[], exercises: Exercise[], today = toISODate(new Date())): LiftStats {
  const workouts = [...all].sort(sortWorkouts);
  const groupOf = new Map(exercises.map((e) => [e.id, e.group]));

  // A PR is a top set heavier than the best weight logged before it. The first
  // time an exercise is logged sets the baseline; it is not a PR.
  const best: Record<string, Best> = {};
  const prSets = new Set<string>();
  const prs: PR[] = [];
  for (const w of workouts) {
    for (const en of w.entries) {
      const mi = topSetIndex(en.sets);
      if (mi < 0) continue;
      const top = en.sets[mi];
      const b = best[en.exercise_id];
      if (b && top.w > b.w) {
        prSets.add(`${w.id}|${en.exercise_id}|${mi}`);
        prs.push({ workoutId: w.id, date: w.date, exerciseId: en.exercise_id, w: top.w, r: top.r, prev: b.w });
      }
      if (!b || top.w > b.w || (top.w === b.w && top.r > b.r)) {
        best[en.exercise_id] = { w: top.w, r: top.r, date: w.date, workoutId: w.id };
      }
    }
  }

  // Streak: consecutive Monday-to-Sunday weeks with at least 3 workouts. The
  // current week counts once it reaches 3, and doesn't break the streak before.
  const weekStart = weekOf(today);
  const perWeek = new Map<string, number>();
  for (const w of workouts) perWeek.set(weekOf(w.date), (perWeek.get(weekOf(w.date)) ?? 0) + 1);
  const hit = (wk: string) => (perWeek.get(wk) ?? 0) >= STREAK_TARGET;
  let streak = hit(weekStart) ? 1 : 0;
  for (let wk = toISODate(addDays(fromISODate(weekStart), -7)); hit(wk); wk = toISODate(addDays(fromISODate(wk), -7))) {
    streak++;
  }
  let bestStreak = streak;
  if (workouts.length) {
    let run = 0;
    for (let wk = weekOf(workouts[0].date); wk <= weekStart; wk = toISODate(addDays(fromISODate(wk), 7))) {
      if (hit(wk)) bestStreak = Math.max(bestStreak, ++run);
      else if (wk !== weekStart) run = 0;
    }
  }

  const weekEnd = toISODate(addDays(fromISODate(weekStart), 6));
  const thisWeek = workouts.filter((w) => w.date >= weekStart && w.date <= weekEnd);
  const ym = today.slice(0, 7);
  const month = workouts.filter((w) => w.date.slice(0, 7) === ym);
  const volumeByGroup: Partial<Record<MuscleGroup, number>> = {};
  let monthVolume = 0;
  for (const w of month) {
    for (const e of w.entries) {
      const g = groupOf.get(e.exercise_id) ?? 'core';
      const v = e.sets.reduce((s, x) => s + x.w * x.r, 0);
      volumeByGroup[g] = (volumeByGroup[g] ?? 0) + v;
      monthVolume += v;
    }
  }

  return {
    workouts,
    best,
    prSets,
    prs,
    thisWeek,
    weekStart,
    streak,
    bestStreak,
    month,
    monthVolume,
    volumeByGroup,
    weekVolume: thisWeek.reduce((s, w) => s + workoutVolume(w), 0)
  };
}

/** Last logged sets for an exercise before a date (for "last time" hints). */
export function lastSets(workouts: Workout[], exerciseId: string, beforeDate?: string): { date: string; sets: SetEntry[] } | null {
  const sorted = [...workouts].sort(sortWorkouts).reverse();
  for (const w of sorted) {
    if (beforeDate && w.date > beforeDate) continue;
    const en = w.entries.find((e) => e.exercise_id === exerciseId && e.sets.length);
    if (en) return { date: w.date, sets: en.sets };
  }
  return null;
}

/** Short title from the first two muscle groups, e.g. "Chest & Shoulders". */
export function workoutTitle(w: Workout, exercises: Exercise[], labels: Record<MuscleGroup, string>): string {
  const groupOf = new Map(exercises.map((e) => [e.id, e.group]));
  const gs: MuscleGroup[] = [];
  for (const e of w.entries) {
    const g = groupOf.get(e.exercise_id);
    if (g && !gs.includes(g)) gs.push(g);
  }
  return gs.slice(0, 2).map((g) => labels[g]).join(' & ') || 'Workout';
}
