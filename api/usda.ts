// Vercel function: USDA FoodData Central, per 100 g.
//   GET /api/usda?q=chicken%20breast   search
//   GET /api/usda?id=171477            one food's household portions (e.g. "1 clove" = 3 g)
//   (both with Authorization: Bearer <Supabase access token>)
// The USDA key lives only in the USDA_API_KEY environment variable (Vercel),
// never in the browser. Only signed-in app users can use it.

const env = (...names: string[]) => names.map((n) => process.env[n]).find((v) => v) ?? '';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

// USDA nutrient numbers: energy (kcal; Foundation foods use the Atwater ones), protein, fat, carbs.
const KCAL = ['208', '958', '957'];
const PROTEIN = '203';
const FAT = '204';
const CARBS = '205';

type UsdaNutrient = { nutrientNumber?: string; unitName?: string; value?: number };
type UsdaFood = { fdcId: number; description: string; dataType?: string; foodNutrients?: UsdaNutrient[] };

async function signedIn(req: Request): Promise<boolean> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const url = env('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anon = env('SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'VITE_SUPABASE_ANON_KEY');
  if (!token || !url || !anon) return false;
  const res = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anon, Authorization: `Bearer ${token}` } });
  return res.ok;
}

export async function GET(req: Request): Promise<Response> {
  const key = env('USDA_API_KEY');
  if (!key) return json({ error: 'USDA search is not set up yet (no USDA_API_KEY in Vercel).' }, 503);
  if (!(await signedIn(req))) return json({ error: 'Sign in first.' }, 401);

  const id = (new URL(req.url).searchParams.get('id') ?? '').trim();
  if (id) return portions(id, key);

  const q = (new URL(req.url).searchParams.get('q') ?? '').trim();
  if (q.length < 2 || q.length > 100) return json({ error: 'Search for 2 to 100 characters.' }, 400);

  const params = new URLSearchParams({ query: q, dataType: 'Foundation,SR Legacy', pageSize: '15', api_key: key });
  const res = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?${params}`);
  if (!res.ok) return json({ error: `USDA search failed (${res.status}).` }, 502);
  const body = (await res.json()) as { foods?: UsdaFood[] };

  const pick = (f: UsdaFood, nums: string[]) => {
    for (const n of nums) {
      const v = f.foodNutrients?.find((x) => x.nutrientNumber === n && (n !== '208' || x.unitName?.toUpperCase() === 'KCAL'))?.value;
      if (typeof v === 'number') return v;
    }
    return undefined;
  };
  const r1 = (x: number | undefined) => Math.round((x ?? 0) * 10) / 10;

  const foods = (body.foods ?? [])
    .map((f) => ({ f, kcal: pick(f, KCAL) }))
    .filter((x): x is { f: UsdaFood; kcal: number } => x.kcal !== undefined)
    .map(({ f, kcal }) => ({
      source: 'USDA',
      ref: String(f.fdcId),
      name: f.description,
      detail: f.dataType,
      nutrition: { kcal: Math.round(kcal), p: r1(pick(f, [PROTEIN])), c: r1(pick(f, [CARBS])), f: r1(pick(f, [FAT])) }
    }));
  return json({ foods });
}

type UsdaPortion = { amount?: number; gramWeight?: number; modifier?: string; portionDescription?: string; measureUnit?: { name?: string } };

/** Household measures for one food, as { label: "1 clove", grams: 3 }. */
async function portions(id: string, key: string): Promise<Response> {
  if (!/^\d{1,10}$/.test(id)) return json({ error: 'Bad food id.' }, 400);
  const res = await fetch(`https://api.nal.usda.gov/fdc/v1/food/${id}?${new URLSearchParams({ api_key: key })}`);
  if (!res.ok) return json({ error: `USDA lookup failed (${res.status}).` }, 502);
  const body = (await res.json()) as { foodPortions?: UsdaPortion[] };
  const out = (body.foodPortions ?? [])
    .filter((p) => typeof p.gramWeight === 'number' && p.gramWeight > 0)
    .map((p) => {
      const unit = p.measureUnit?.name && p.measureUnit.name !== 'undetermined' ? p.measureUnit.name : '';
      const what = [unit, p.modifier || p.portionDescription || ''].filter(Boolean).join(' ').trim();
      return { label: `${p.amount ?? 1} ${what}`.trim(), grams: Math.round(p.gramWeight! * 10) / 10 };
    })
    .filter((p) => p.label.length > 1);
  return json({ portions: out });
}

