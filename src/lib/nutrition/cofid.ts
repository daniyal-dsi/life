import type { FoodResult } from './types';

// CoFID 2021 (McCance and Widdowson), shipped with the app as
// /data/cofid-2021.json and loaded the first time someone searches.
// Contains public sector information licensed under the Open Government
// Licence v3.0.

type Raw = { foods: [code: string, name: string, group: string, kcal: number, p: number | null, c: number | null, f: number | null][] };

let cache: Promise<FoodResult[]> | null = null;

export function loadCofid(): Promise<FoodResult[]> {
  cache ??= fetch('/data/cofid-2021.json')
    .then((r) => {
      if (!r.ok) throw new Error('Could not load the food database.');
      return r.json() as Promise<Raw>;
    })
    .then((d) =>
      d.foods.map(([code, name, group, kcal, p, c, f]) => ({
        source: 'CoFID' as const,
        ref: code,
        name,
        group,
        nutrition: { kcal, p: p ?? 0, c: c ?? 0, f: f ?? 0 }
      }))
    )
    .catch((err) => {
      cache = null;
      throw err;
    });
  return cache;
}

// What people type -> how CoFID names it.
const SYNONYMS: Record<string, string[]> = {
  yoghurt: ['yogurt'],
  yoghurts: ['yogurt'],
  penne: ['pasta'],
  spaghetti: ['pasta'],
  fusilli: ['pasta'],
  macaroni: ['pasta'],
  chickpea: ['chick', 'peas'],
  chickpeas: ['chick', 'peas']
};

const words = (q: string) =>
  q
    .toLowerCase()
    .split(/[^a-z0-9%é]+/)
    .filter((w) => w.length > 1)
    .flatMap((w) => SYNONYMS[w] ?? [w]);

/** Best matches: every word must appear; earlier and whole-word matches rank higher. */
export function searchFoods(foods: FoodResult[], query: string, limit = 12): FoodResult[] {
  const ws = words(query);
  if (!ws.length) return [];
  const scored: { r: FoodResult; score: number }[] = [];
  for (const r of foods) {
    const n = r.name.toLowerCase();
    let score = 0;
    let ok = true;
    for (const w of ws) {
      const stem = w.replace(/(es|s)$/, '');
      const i = n.indexOf(w) >= 0 ? n.indexOf(w) : n.indexOf(stem);
      if (i < 0) {
        ok = false;
        break;
      }
      score += 10 - Math.min(9, Math.floor(i / 8));
      if (new RegExp(`\\b${stem}`).test(n)) score += 5;
    }
    if (!ok) continue;
    // Prefer plain entries ("Chicken, breast, grilled") over long composite dishes.
    score -= Math.min(6, Math.floor(n.length / 20));
    if (n.startsWith(ws[0])) score += 8;
    scored.push({ r, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.r.name.length - b.r.name.length)
    .slice(0, limit)
    .map((x) => x.r);
}
