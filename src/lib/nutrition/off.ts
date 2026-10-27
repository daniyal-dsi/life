import type { FoodResult } from './types';

// Open Food Facts: branded products by barcode. Free and open; no key needed.

export async function lookupBarcode(barcode: string): Promise<FoodResult | null> {
  const code = barcode.replace(/\D/g, '');
  if (code.length < 8 || code.length > 14) throw new Error('That barcode should be 8 to 14 digits.');
  const down = "Open Food Facts isn't responding right now. Try again in a minute, or enter it by hand from the pack.";
  // A network or CORS failure (their error pages carry no CORS header) means the service is down.
  const res = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,product_name_en,brands,quantity,nutriments,serving_quantity,serving_quantity_unit,serving_size`
  ).catch(() => {
    throw new Error(down);
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(down);
  const body = await res.json();
  if (body.status !== 1 || !body.product) return null;
  const p = body.product;
  const n = p.nutriments ?? {};
  const kcal = n['energy-kcal_100g'] ?? (n['energy_100g'] ? n['energy_100g'] / 4.184 : undefined);
  if (kcal === undefined) throw new Error('This product has no nutrition per 100 g on Open Food Facts. Type it in from the pack.');
  const name = (p.product_name_en || p.product_name || 'Unnamed product').trim();
  const r1 = (x: unknown) => Math.round((Number(x) || 0) * 10) / 10;
  // Serving size in grams when the pack gives one (e.g. "1 bar (45 g)" with serving_quantity 45).
  const unit = String(p.serving_quantity_unit ?? 'g').toLowerCase();
  const sq = Number(p.serving_quantity);
  const servingGrams = sq > 0 && (unit === 'g' || unit === 'ml') ? Math.round(sq * 10) / 10 : undefined;
  return {
    ...(servingGrams ? { servingGrams, servingLabel: String(p.serving_size || `${servingGrams} ${unit}`).trim() } : {}),
    source: 'Open Food Facts',
    ref: code,
    name,
    detail: [p.brands, p.quantity].filter(Boolean).join(' · '),
    nutrition: { kcal: Math.round(Number(kcal)), p: r1(n.proteins_100g), c: r1(n.carbohydrates_100g), f: r1(n.fat_100g) }
  };
}
