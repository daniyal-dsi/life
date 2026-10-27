import type { Nutrition, Source } from '@/lib/nutrition/types';
import type { Current } from '@/lib/versioned';

export const TABLES = {
  profile: 'fuellog_profile',
  foods: 'fuellog_foods',
  entries: 'fuellog_entries',
  weights: 'fuellog_weights'
} as const;

export type Sex = 'male' | 'female';
export type Activity = 'sedentary' | 'light' | 'moderate' | 'very';
export type Goal = 'lose' | 'maintain' | 'gain';
export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

export const ACTIVITIES: { id: Activity; label: string; factor: number }[] = [
  { id: 'sedentary', label: 'Sedentary', factor: 1.2 },
  { id: 'light', label: 'Light', factor: 1.375 },
  { id: 'moderate', label: 'Moderate', factor: 1.55 },
  { id: 'very', label: 'Very active', factor: 1.725 }
];

export const GOALS: { id: Goal; label: string }[] = [
  { id: 'lose', label: 'Lose weight' },
  { id: 'maintain', label: 'Maintain' },
  { id: 'gain', label: 'Gain' }
];

export const MEALS: { id: Meal; label: string }[] = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'snacks', label: 'Snacks' }
];

export type ProfileData = {
  weight_kg: number;
  height_cm: number;
  age: number;
  sex: Sex;
  activity: Activity;
  goal: Goal;
  /** Starter profile, shown with a "set up yours" prompt until saved. */
  sample?: boolean;
};

/**
 * A food in My Foods. Hand-made foods are per serving (macros optional,
 * null = not given). Foods saved from a database search or scan also keep
 * their source, database ref and values per 100 g; their kcal/p/c/f are per
 * serving when the serving size is known, otherwise per 100 g.
 */
export type FoodData = {
  name: string;
  kcal: number;
  p: number | null;
  c: number | null;
  f: number | null;
  source?: Source;
  /** Database id (CoFID code, USDA fdcId, barcode); with source, used to avoid duplicates. */
  ref?: string;
  per_100g?: Nutrition | null;
  serving_grams?: number | null;
  /** e.g. "1 bar (45 g)". */
  serving_label?: string | null;
};

/**
 * One logged food. Keeps a copy of the food's values at the time, so editing
 * the food later doesn't change past days.
 */
export type EntryData = {
  date: string;
  meal: Meal;
  food_id: string;
  servings: number;
  name: string;
  kcal: number;
  p: number | null;
  c: number | null;
  f: number | null;
  sample?: boolean;
  /** Set when logged from a Meal Prep meal (food_id is then the meal's id). */
  meal_id?: string | null;
  /**
   * How much was eaten. By weight: grams set, kcal/p/c/f are per 100 g and
   * servings = grams / 100. By serving: kcal/p/c/f are per serving and
   * servings is the count; serving_label says what one serving is.
   */
  grams?: number | null;
  per_100g?: Nutrition | null;
  serving_grams?: number | null;
  serving_label?: string | null;
};

/** "150 g", "2 × 1 bar (45 g)" or "× 1.5" for a logged entry. */
export function amountLabel(e: Pick<EntryData, 'grams' | 'servings' | 'serving_label'>): string {
  const n = (x: number) => String(Math.round(x * 100) / 100);
  if (e.grams) return `${Math.round(e.grams)} g`;
  if (e.serving_label) return `${n(e.servings)} × ${e.serving_label}`;
  return `× ${n(e.servings)}`;
}

export type WeightData = { date: string; kg: number; sample?: boolean };

export type Food = Current<FoodData>;
export type Entry = Current<EntryData>;
export type WeightEntry = Current<WeightData>;
