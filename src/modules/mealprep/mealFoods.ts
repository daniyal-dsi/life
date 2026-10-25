import { mealMacros } from './macros';
import { useOptionalMealPrep } from './store';
import type { MealType } from './types';

/** A Meal Prep meal seen as a Fuel Log food: one portion, current recipe. */
export type MealFood = { id: string; name: string; type: MealType; kcal: number; p: number; c: number; f: number; counted: boolean };

const oneDp = (n: number) => Math.round(n * 10) / 10;

/**
 * Every meal as a food, worked out live from the shared recipe, so it always
 * matches the latest version. Empty when Meal Prep isn't available.
 */
export function useMealFoods(): MealFood[] {
  const mp = useOptionalMealPrep();
  if (!mp) return [];
  return mp.meals.map((m) => {
    const M = mealMacros(m.lines, mp.ingredients);
    return { id: m.id, name: m.name, type: m.type, kcal: Math.round(M.kcal), p: oneDp(M.p), c: oneDp(M.c), f: oneDp(M.f), counted: M.counted > 0 };
  });
}
