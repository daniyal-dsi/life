import type { Aisle, Nutrition, Source } from '../types';

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

/** Aisle from the CoFID group letter, or from the name for other sources. */
export function guessAisle(r: FoodResult): Aisle {
  const g = r.group?.[0];
  if (g === 'M' || g === 'J') return 'meat';
  if (g === 'B' || g === 'C') return 'dairy';
  if (g === 'D' || g === 'F') return 'veg';
  if (g === 'H' || g === 'W') return 'spice';
  if (g) return 'cupboard';
  const n = r.name.toLowerCase();
  if (/powder|pepper, black|salt|mustard|mayo|sauce|spice|herb/.test(n)) return 'spice';
  if (/chicken|beef|lamb|pork|turkey|mince|salmon|cod|tuna|fish/.test(n) && !/canned|tin/.test(n)) return 'meat';
  if (/milk|yog|cheese|butter|egg|cream/.test(n)) return 'dairy';
  if (/canned|tin|rice|pasta|oat|flour|stock|juice|passata/.test(n)) return 'cupboard';
  return 'veg';
}

/** Cooked weight from 100 g raw, for values given cooked (meat ~75, boiled rice/pasta ~250). */
export function guessCooked(r: FoodResult, aisle: Aisle): number {
  const n = r.name.toLowerCase();
  if (/\braw\b|uncooked|dried(?!, boiled)/.test(n) && !/boiled|cooked/.test(n)) return 100;
  if (aisle === 'meat' && /grilled|roasted|stewed|fried|baked|cooked|boiled|steamed/.test(n)) return 75;
  if (/(rice|pasta|noodles|spaghetti|couscous).*(boiled|cooked)/.test(n)) return 250;
  return 100;
}
