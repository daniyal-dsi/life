import type { Version } from '@/lib/versioned';
import { ACTIVITIES, type Entry, type ProfileData } from './types';

// Daily calorie and macro targets from the profile (Mifflin-St Jeor).

export type Targets = { bmr: number; tdee: number; kcal: number; protein: number; carbs: number; fat: number };

export function targets(p: ProfileData): Targets {
  const w = p.weight_kg || 0;
  const bmr = 10 * w + 6.25 * (p.height_cm || 0) - 5 * (p.age || 0) + (p.sex === 'female' ? -161 : 5);
  const factor = ACTIVITIES.find((a) => a.id === p.activity)?.factor ?? 1.2;
  const tdee = bmr * factor;
  // 15% deficit to lose, 10% surplus to gain, rounded to 5 kcal.
  const goal = p.goal === 'lose' ? tdee * 0.85 : p.goal === 'gain' ? tdee * 1.1 : tdee;
  const kcal = Math.max(0, Math.round(goal / 5) * 5);
  // Protein 2 g per kg, fat 25% of calories, carbs the rest.
  const protein = Math.round(w * 2);
  const fat = Math.round((kcal * 0.25) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { bmr: Math.round(bmr), tdee: Math.round(tdee), kcal, protein, carbs, fat };
}

/** Local date (YYYY-MM-DD) of a stored timestamp. */
const localDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * The profile that applied on a date: the newest version saved on or before
 * it (or the first one, for days before any profile). Past days keep being
 * scored against the target they had at the time.
 */
export function profileOn(versions: Version<ProfileData>[], date: string): ProfileData | null {
  const live = versions.filter((v) => !v.deleted).sort((a, b) => a.created_at.localeCompare(b.created_at));
  if (!live.length) return null;
  let pick = live[0];
  for (const v of live) if (localDate(v.created_at) <= date) pick = v;
  return pick.data;
}

export type Totals = { kcal: number; p: number; c: number; f: number };

export function totals(entries: Entry[]): Totals {
  return entries.reduce(
    (s, e) => ({
      kcal: s.kcal + e.kcal * e.servings,
      p: s.p + (e.p ?? 0) * e.servings,
      c: s.c + (e.c ?? 0) * e.servings,
      f: s.f + (e.f ?? 0) * e.servings
    }),
    { kcal: 0, p: 0, c: 0, f: 0 }
  );
}

export type DayStatus = 'ok' | 'over' | 'none' | 'future';

export function dayStatus(date: string, today: string, entries: Entry[], target: number | null): DayStatus {
  if (date > today) return 'future';
  const day = entries.filter((e) => e.date === date);
  if (!day.length || target === null) return 'none';
  return totals(day).kcal <= target ? 'ok' : 'over';
}
