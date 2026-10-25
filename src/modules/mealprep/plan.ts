import { addDays, fromISODate, startOfWeek, toISODate } from '@/lib/date';
import { mealMacros } from './macros';
import { DEFAULT_GRAMS, MEAL_TYPES, type Aisle, type Ingredient, type Meal, type MealType, type PlanEntry, type ShopRow, type Unit } from './types';

// Week plan maths: batches (cooks), your daily macros, and the shopping list.

export const mondayOf = (iso: string) => toISODate(startOfWeek(fromISODate(iso)));
export const weekDates = (monday: string) => Array.from({ length: 7 }, (_, i) => toISODate(addDays(fromISODate(monday), i)));

export function weekPlan(plan: PlanEntry[], monday: string): PlanEntry[] {
  const end = toISODate(addDays(fromISODate(monday), 6));
  return plan.filter((p) => p.date >= monday && p.date <= end);
}

export type Cook = { meal: Meal; slot: MealType; dates: string[]; portions: number };

/** The same meal in the same slot on several days is cooked once, as a batch. */
export function cooks(week: PlanEntry[], meals: Meal[]): Cook[] {
  const map = new Map<string, Cook>();
  const order = (s: MealType) => MEAL_TYPES.findIndex((t) => t.id === s);
  for (const p of [...week].sort((a, b) => a.date.localeCompare(b.date) || order(a.slot) - order(b.slot))) {
    const meal = meals.find((m) => m.id === p.meal_id);
    if (!meal) continue;
    const key = `${p.slot}|${p.meal_id}`;
    const c = map.get(key) ?? { meal, slot: p.slot, dates: [], portions: 0 };
    c.dates.push(p.date);
    c.portions += p.eaters.length;
    map.set(key, c);
  }
  return [...map.values()];
}

/** Average per day of the planned meals one person eats, over days they eat any. */
export function dailyAverage(week: PlanEntry[], meals: Meal[], ingredients: Ingredient[], personId: string) {
  const days = new Set<string>();
  const sum = { kcal: 0, p: 0, c: 0, f: 0 };
  for (const p of week) {
    if (!p.eaters.includes(personId)) continue;
    const meal = meals.find((m) => m.id === p.meal_id);
    if (!meal) continue;
    const M = mealMacros(meal.lines, ingredients);
    days.add(p.date);
    sum.kcal += M.kcal;
    sum.p += M.p;
    sum.c += M.c;
    sum.f += M.f;
  }
  const n = days.size;
  return { days: n, kcal: n ? sum.kcal / n : 0, p: n ? sum.p / n : 0, c: n ? sum.c / n : 0, f: n ? sum.f / n : 0 };
}

// ---------------------------------------------------------------- shopping

const trim = (x: number) => String(Math.round(x * 100) / 100);
const fmtG = (g: number) => (g >= 1000 ? `${trim(Math.round(g / 10) / 100)} kg` : `${Math.round(g)} g`);
const COUNT_LABEL: Partial<Record<Unit, [string, string]>> = {
  tin: ['tin', 'tins'],
  clove: ['clove', 'cloves'],
  bunch: ['bunch', 'bunches'],
  cup: ['cup', 'cups'],
  tbsp: ['tbsp', 'tbsp'],
  tsp: ['tsp', 'tsp'],
  whole: ['', '']
};

function unitText(q: number, u: Unit): string {
  const l = COUNT_LABEL[u];
  if (!l) return `${trim(q)} ${u}`;
  const w = q > 1 ? l[1] : l[0];
  return `${trim(q)}${w ? ` ${w}` : ''}`;
}

/**
 * What to buy for amounts summed per unit. Grams are COOKED weight in
 * recipes, so they are scaled up to raw (and rounded up to 10 g).
 */
export function amountToBuy(ing: Ingredient, units: Partial<Record<Unit, number>>): { text: string; cooked: string } {
  const us = Object.keys(units) as Unit[];
  if (!us.length) return { text: '', cooked: '' };
  const raw = (g: number) => (ing.cooked_per_100g_raw < 100 ? Math.ceil((g * 100) / ing.cooked_per_100g_raw / 10) * 10 : g);
  const shrinks = ing.cooked_per_100g_raw < 100;
  if (us.length === 1) {
    const u = us[0];
    const q = units[u]!;
    if (u === 'g') return { text: fmtG(raw(q)), cooked: shrinks ? fmtG(q) : '' };
    if (u === 'ml') return { text: q >= 1000 ? `${trim(q / 1000)} l` : `${Math.round(q)} ml`, cooked: '' };
    return { text: unitText(q, u), cooked: '' };
  }
  let g = 0;
  let exact = true;
  for (const u of us) {
    const per = ing.grams_per[u] ?? DEFAULT_GRAMS[u];
    if (per) g += units[u]! * per;
    else exact = false;
  }
  return { text: `${exact ? '' : 'about '}${fmtG(raw(g))}`, cooked: shrinks ? fmtG(g) : '' };
}

export type ShopItem = {
  ingredient: Ingredient;
  /** Calculated amount to buy ('' when recipes give no amount). */
  calc: string;
  /** Edited amount, if any. */
  amount: string | null;
  cooked: string;
  meals: string;
  done: boolean;
};

export type ShoppingList = {
  aisles: { aisle: Aisle; items: ShopItem[] }[];
  staples: ShopItem[];
  extras: (ShopRow & { kind: 'extra'; name: string })[];
  total: number;
  done: number;
};

/** One portion per person per planned meal, grouped by aisle; staples apart. */
export function shoppingList(week: PlanEntry[], meals: Meal[], ingredients: Ingredient[], state: ShopRow[], monday: string, aisles: Aisle[]): ShoppingList {
  const agg = new Map<string, { units: Partial<Record<Unit, number>>; meals: Map<string, number> }>();
  for (const p of week) {
    const meal = meals.find((m) => m.id === p.meal_id);
    if (!meal) continue;
    const n = p.eaters.length;
    for (const line of meal.lines) {
      const a = agg.get(line.ingredient_id) ?? { units: {} as Partial<Record<Unit, number>>, meals: new Map<string, number>() };
      if (line.qty && line.qty > 0) a.units[line.unit] = (a.units[line.unit] ?? 0) + line.qty * n;
      a.meals.set(meal.name, (a.meals.get(meal.name) ?? 0) + n);
      agg.set(line.ingredient_id, a);
    }
  }
  const rows = state.filter((r) => r.week === monday);
  const items: ShopItem[] = [];
  for (const [id, a] of agg) {
    const ingredient = ingredients.find((i) => i.id === id);
    if (!ingredient) continue;
    const s = rows.find((r) => r.kind === 'item' && r.ingredient_id === id) as (ShopRow & { kind: 'item' }) | undefined;
    const amt = amountToBuy(ingredient, a.units);
    items.push({
      ingredient,
      calc: amt.text,
      amount: s?.amount ?? null,
      cooked: s?.amount ? '' : amt.cooked,
      meals: [...a.meals].map(([name, k]) => (k > 1 ? `${name} ×${k}` : name)).join(' · '),
      done: !!s?.done
    });
  }
  items.sort((x, y) => x.ingredient.name.localeCompare(y.ingredient.name));
  const extras = rows.filter((r): r is ShopRow & { kind: 'extra'; name: string } => r.kind === 'extra').sort((x, y) => x.created_at.localeCompare(y.created_at));
  const regular = items.filter((i) => !i.ingredient.staple);
  return {
    aisles: aisles.map((aisle) => ({ aisle, items: regular.filter((i) => i.ingredient.aisle === aisle) })).filter((g) => g.items.length),
    staples: items.filter((i) => i.ingredient.staple),
    extras,
    total: regular.length + extras.length,
    done: regular.filter((i) => i.done).length + extras.filter((e) => e.done).length
  };
}

/** Plain-text list for sharing (what's left to buy). */
export function shoppingText(list: ShoppingList, monday: string, aisleLabel: (a: Aisle) => string): string {
  const head = `Shopping list, week of ${fromISODate(monday).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
  const out = [head];
  for (const g of list.aisles) {
    const left = g.items.filter((i) => !i.done);
    if (!left.length) continue;
    out.push('', aisleLabel(g.aisle), ...left.map((i) => `- ${i.ingredient.name}${(i.amount ?? i.calc) ? `: ${i.amount ?? i.calc}` : ''}`));
  }
  const extras = list.extras.filter((e) => !e.done);
  if (extras.length) out.push('', 'Other', ...extras.map((e) => `- ${e.name}`));
  if (list.staples.length) out.push('', 'Check you have', ...list.staples.map((i) => `- ${i.ingredient.name}${(i.amount ?? i.calc) ? `: ${i.amount ?? i.calc}` : ''}`));
  return out.join('\n');
}
