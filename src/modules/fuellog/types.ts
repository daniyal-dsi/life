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

/** Per serving. Macros are optional (null = not given). */
export type FoodData = { name: string; kcal: number; p: number | null; c: number | null; f: number | null };

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
};

export type WeightData = { date: string; kg: number; sample?: boolean };

export type Food = Current<FoodData>;
export type Entry = Current<EntryData>;
export type WeightEntry = Current<WeightData>;
