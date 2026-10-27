// Shared nutrition search (Fuel Log and Meal Prep): CoFID, USDA and Open Food Facts.

export type Nutrition = { kcal: number; p: number; c: number; f: number };
export type Source = 'CoFID' | 'USDA' | 'Open Food Facts' | 'Pack' | 'Manual';
export const SOURCES: Source[] = ['CoFID', 'USDA', 'Open Food Facts', 'Pack', 'Manual'];

/** A household measure from the database, e.g. { label: '1 clove', grams: 3 }. */
export type Portion = { label: string; grams: number };

/** One food from a nutrition database, per 100 g. */
export type FoodResult = {
  source: Source;
  /** Database id: CoFID food code, USDA fdcId or barcode. */
  ref: string;
  name: string;
  /** Extra detail shown under the name (brand, pack size, data type). */
  detail?: string;
  nutrition: Nutrition;
  /** CoFID food group code, used to guess the aisle. */
  group?: string;
  /** One serving, when the product says (e.g. 45 g, "1 bar (45 g)"). */
  servingGrams?: number;
  servingLabel?: string;
  /** Household measures (USDA), used for grams per unit. */
  portions?: Portion[];
};

/** "Chicken, breast, grilled" -> "Chicken breast (grilled)". */
export function friendlyName(dbName: string): string {
  const parts = dbName.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length <= 1) return dbName.trim();
  // Join the first two parts when the second is a cut or variety (one or two words).
  const [a, b, ...rest] = parts;
  const head = b.split(' ').length <= 2 ? `${a} ${b.toLowerCase()}` : a;
  const tail = b.split(' ').length <= 2 ? rest : [b, ...rest];
  return tail.length ? `${head} (${tail.join(', ').toLowerCase()})` : head;
}
