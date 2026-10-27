import type { Nutrition, Source } from '@/lib/nutrition/types';
import type { Current } from '@/lib/versioned';

export type { Nutrition, Source };

// Meal Prep library. Shared by the household: both people see and edit the
// same ingredients and meals.

export const TABLES = {
  ingredients: 'mealprep_ingredients',
  meals: 'mealprep_meals',
  plan: 'mealprep_plan',
  shopping: 'mealprep_shopping'
} as const;

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
/** Units that are already weights (ml counted as grams); every other unit needs a grams-per-unit figure. */
export const BY_WEIGHT: Partial<Record<Unit, number>> = { g: 1, ml: 1 };

export type MealType = 'breakfast' | 'lunch' | 'dinner';
export const MEAL_TYPES: { id: MealType; label: string }[] = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' }
];


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
export type Line = {
  key: string;
  ingredient_id: string;
  qty: number | null;
  unit: Unit;
  /** Asked how much one unit weighs and chose "Skip": not counted, not asked again. */
  skip_weight?: boolean;
};

export type MealData = { name: string; type: MealType; link: string | null; lines: Line[] };

export type Ingredient = Current<IngredientData>;
export type Meal = Current<MealData>;

/** One planned meal. One entity per date and slot (its id is derived from them). */
export type PlanData = { date: string; slot: MealType; meal_id: string; eaters: string[] };

/**
 * Shopping list state for a week (keyed by its Monday). "item" rows hold the
 * tick and any edited amount for an ingredient; "extra" rows are added items.
 */
export type ShopData =
  | { week: string; kind: 'item'; ingredient_id: string; done: boolean; amount: string | null }
  | { week: string; kind: 'extra'; name: string; done: boolean };

export type PlanEntry = Current<PlanData>;
export type ShopRow = Current<ShopData>;

