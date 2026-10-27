import { BY_WEIGHT, type Ingredient, type Line } from './types';

// Per-portion nutrition for a recipe, and why any lines aren't counted.

export type Uncounted = { line: Line; name: string; reason: 'no amount' | 'no unit size' | 'no nutrition' | 'missing' };
export type Macros = { kcal: number; p: number; c: number; f: number; counted: number; uncounted: Uncounted[]; toSpecify: number };

export function gramsOf(line: Line, ing: Ingredient): number | null | undefined {
  if (line.qty === null || !(line.qty > 0)) return null; // no amount
  // Grams and ml count directly; other units only with a known weight for this ingredient.
  const per = BY_WEIGHT[line.unit] ?? ing.grams_per[line.unit];
  return per ? line.qty * per : undefined; // undefined: no size for this unit
}

export function mealMacros(lines: Line[], ingredients: Ingredient[]): Macros {
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const m: Macros = { kcal: 0, p: 0, c: 0, f: 0, counted: 0, uncounted: [], toSpecify: 0 };
  for (const line of lines) {
    const ing = byId.get(line.ingredient_id);
    if (!ing) {
      m.uncounted.push({ line, name: 'Removed ingredient', reason: 'missing' });
      continue;
    }
    if (ing.ask) m.toSpecify++;
    const g = gramsOf(line, ing);
    if (g === null) m.uncounted.push({ line, name: ing.name, reason: 'no amount' });
    else if (g === undefined) m.uncounted.push({ line, name: ing.name, reason: 'no unit size' });
    else if (!ing.nutrition) m.uncounted.push({ line, name: ing.name, reason: 'no nutrition' });
    else {
      const k = g / 100;
      m.kcal += ing.nutrition.kcal * k;
      m.p += ing.nutrition.p * k;
      m.c += ing.nutrition.c * k;
      m.f += ing.nutrition.f * k;
      m.counted++;
    }
  }
  return m;
}

/** Short warnings for a meal card. */
export function mealFlags(lines: Line[], m: Macros): string[] {
  const n = (k: number, w: string) => `${k} ${w}${k === 1 ? '' : 's'}`;
  const by = (r: Uncounted['reason']) => m.uncounted.filter((u) => u.reason === r).length;
  const out: string[] = [];
  if (!lines.length) out.push('No ingredients yet');
  if (by('no amount')) out.push(`${n(by('no amount'), 'ingredient')} without amounts`);
  if (m.toSpecify) out.push(`${n(m.toSpecify, 'ingredient')} to specify`);
  if (by('no nutrition')) out.push(`${by('no nutrition')} missing nutrition`);
  if (by('no unit size')) out.push(`${by('no unit size')} need a unit size`);
  return out;
}

/** Accepts links with or without https://; null if it isn't a web address. */
export function normaliseLink(input: string): string | null | '' {
  const s = input.trim();
  if (!s) return '';
  const withScheme = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    if (!/^https?:$/.test(u.protocol) || !/\.[a-z]{2,}$/i.test(u.hostname)) return null;
    return u.href;
  } catch {
    return null;
  }
}

/** "instagram.com" from a link. */
export function siteName(link: string): string {
  try {
    return new URL(link).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
