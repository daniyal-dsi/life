import type { FoodResult, Portion } from '@/lib/nutrition/types';
import type { Aisle, Unit } from './types';

// Meal Prep's assumptions when an ingredient comes from a food database:
// aisle, how its weight changes when cooked, and grams per unit.

/** Aisle from the CoFID group letter, or from the name for other sources. */
export function guessAisle(r: Pick<FoodResult, 'name' | 'group'>): Aisle {
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

// ---------------------------------------------------------------- cooked weight

export type CookedKind = 'same' | 'shrinks' | 'absorbs';
export const COOKED: Record<CookedKind, { grams: number; label: string; choice: string }> = {
  same: { grams: 100, label: 'same as raw', choice: 'Same weight' },
  shrinks: { grams: 75, label: 'Shrinks when cooked', choice: 'Shrinks: meat or fish' },
  absorbs: { grams: 250, label: 'Absorbs water', choice: 'Absorbs water: rice, pasta, pulses' }
};

/** Which of the three a stored figure is (null = a custom exact figure). */
export function cookedKind(grams: number): CookedKind | null {
  return (Object.keys(COOKED) as CookedKind[]).find((k) => COOKED[k].grams === grams) ?? null;
}

const MEAT_FISH =
  /\b(chicken|beef|lamb|pork|turkey|duck|veal|venison|mince|minced|steak|bacon|gammon|sausages?|burgers?|meatballs?|salmon|cod|haddock|tuna|mackerel|trout|sea bass|plaice|hake|pollock|prawns?|shrimps?|fish|kidney|liver)\b/;
const GRAINS_PULSES =
  /\b(rice|pasta|penne|spaghetti|fusilli|macaroni|tagliatelle|linguine|noodles?|couscous|quinoa|bulgur|bulghur|barley|freekeh|polenta|lentils?|split peas|chick ?peas|beans|oats|porridge)\b/;
const ALREADY_COOKED = /\b(canned|tinned|in brine|in water|in oil|smoked|cured|ham|deli|sliced|ready|pouch|microwave)\b/;

/**
 * Cooked weight from 100 g raw, guessed from a name: meat and fish shrink
 * (about 75), rice, pasta, pulses and dried grains absorb water (about 250),
 * everything else stays the same. Tinned and ready-cooked foods don't change.
 */
export function guessCooked(name: string, aisle?: Aisle): CookedKind {
  const n = name.toLowerCase();
  if (ALREADY_COOKED.test(n)) return 'same';
  if (MEAT_FISH.test(n) || aisle === 'meat') return 'shrinks';
  if (GRAINS_PULSES.test(n)) return 'absorbs';
  return 'same';
}

// ---------------------------------------------------------------- grams per unit

/** Count and spoon units that need a weight (g and ml count as grams). */
export const WEIGHED_UNITS: Unit[] = ['tsp', 'tbsp', 'cup', 'tin', 'whole', 'clove', 'bunch'];

/** Sensible defaults; "whole" has none (only from the database or by asking). */
export const UNIT_DEFAULTS: Partial<Record<Unit, number>> = { clove: 5, tsp: 5, tbsp: 15, cup: 240, tin: 400, bunch: 25 };

/** USDA household measures mapped onto our units, per one unit. */
export function portionGrams(portions: Portion[] | undefined): Partial<Record<Unit, number>> {
  const out: Partial<Record<Unit, number>> = {};
  const set = (u: Unit, g: number) => {
    if (!(u in out) && g > 0) out[u] = Math.round(g * 10) / 10;
  };
  // Prefer a "medium" one for whole items.
  const sorted = [...(portions ?? [])].sort((a, b) => Number(/medium/i.test(b.label)) - Number(/medium/i.test(a.label)));
  for (const p of sorted) {
    const m = p.label.toLowerCase().match(/^([\d.\/]+)\s*(.*)$/);
    const amount = m ? evalAmount(m[1]) : 1;
    const what = m ? m[2] : p.label.toLowerCase();
    const per = p.grams / (amount || 1);
    if (/\bclove/.test(what)) set('clove', per);
    else if (/\b(tbsp|tablespoon)/.test(what)) set('tbsp', per);
    else if (/\b(tsp|teaspoon)/.test(what)) set('tsp', per);
    else if (/\bcup\b/.test(what)) set('cup', per);
    else if (/\b(can|tin)\b/.test(what)) set('tin', per);
    else if (/\bbunch/.test(what)) set('bunch', per);
    else if (/\b(medium|large|small|whole|each|item|fruit|egg|piece|onion|pepper|potato)\b/.test(what)) set('whole', per);
  }
  return out;
}

function evalAmount(s: string): number {
  if (s.includes('/')) {
    const [a, b] = s.split('/').map(Number);
    return b ? a / b : 1;
  }
  return Number(s) || 1;
}

/** Grams per unit for a new ingredient: database portions first, then defaults. */
export function autoGrams(portions?: Portion[], existing: Partial<Record<Unit, number>> = {}): Partial<Record<Unit, number>> {
  return { ...UNIT_DEFAULTS, ...portionGrams(portions), ...existing };
}
