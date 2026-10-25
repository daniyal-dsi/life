import type { Current } from '@/lib/versioned';

// Meal Prep library. Shared by the household: both people see and edit the
// same ingredients and meals.

export const TABLES = { ingredients: 'mealprep_ingredients', meals: 'mealprep_meals' } as const;

export type Aisle = 'meat' | 'veg' | 'dairy' | 'cupboard' | 'spice';
export const AISLES: { id: Aisle; label: string }[] = [
  { id: 'meat', label: 'Meat & fish' },
  { id: 'veg', label: 'Fruit & veg' },
  { id: 'dairy', label: 'Dairy & eggs' },
  { id: 'cupboard', label: 'Cupboard' },
  { id: 'spice', label: 'Herbs, spices & sauces' }
];

export type Unit = 'g' | 'ml' | 'tsp' | 'tbsp' | 'cup' | 'tin' | 'whole' | 'clove' | 'bunch';
export const UNITS: Unit[] = ['g', 'ml', 'tsp', 'tbsp', 'cup', 'tin', 'whole', 'clove', 'bunch'];
/** Units an ingredient can have its own gram weight for. */
export const SIZED_UNITS: Exclude<Unit, 'g' | 'ml'>[] = ['tin', 'whole', 'clove', 'bunch', 'cup', 'tbsp', 'tsp'];
/** Fallback grams when an ingredient doesn't give its own (ml counted as grams). */
export const DEFAULT_GRAMS: Partial<Record<Unit, number>> = { g: 1, ml: 1, tsp: 5, tbsp: 15, cup: 240 };

export type MealType = 'breakfast' | 'lunch' | 'dinner';
export const MEAL_TYPES: { id: MealType; label: string }[] = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' }
];

export type Nutrition = { kcal: number; p: number; c: number; f: number };
export type Source = 'CoFID' | 'USDA' | 'Open Food Facts' | 'Pack' | 'Manual';
export const SOURCES: Source[] = ['CoFID', 'USDA', 'Open Food Facts', 'Pack', 'Manual'];

export type IngredientData = {
  name: string;
  aisle: Aisle;
  /** Kept in stock: listed separately on the shopping list. */
  staple: boolean;
  /** Cooked weight from 100 g raw (chicken breast 75). 100 when it doesn't change. */
  cooked_per_100g_raw: number;
  /** Grams for one of each sized unit, e.g. { tin: 112 }. */
  grams_per: Partial<Record<Unit, number>>;
  /** Per 100 g cooked. Null when not known yet. */
  nutrition: Nutrition | null;
  source: Source | null;
  /** The database entry or pack the numbers came from. */
  source_name: string | null;
  /** True for values imported as a starting point, to confirm later. */
  starter?: boolean;
  /** "Type?" question for imported names that are still vague. */
  ask: string | null;
};

/** One ingredient line. Amounts are COOKED weight per portion. */
export type Line = { key: string; ingredient_id: string; qty: number | null; unit: Unit };

export type MealData = { name: string; type: MealType; link: string | null; lines: Line[] };

export type Ingredient = Current<IngredientData>;
export type Meal = Current<MealData>;
