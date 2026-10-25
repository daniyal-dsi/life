// The USDA function, with USDA and Supabase mocked. Run with: npm test
import { GET } from '../api/usda.ts';
let failures = 0; const check = (n: string, ok: boolean, d: unknown = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${n} ${d === '' ? '' : JSON.stringify(d)}`); if (!ok) failures++; };
const calls: string[] = [];
globalThis.fetch = (async (url: string, init?: any) => {
  calls.push(String(url));
  if (String(url).includes('/auth/v1/user')) return new Response('{}', { status: init?.headers?.Authorization === 'Bearer good' ? 200 : 401 });
  return new Response(JSON.stringify({ foods: [
    { fdcId: 1, description: 'Chicken, broilers or fryers, breast, meat only, cooked, roasted', dataType: 'SR Legacy', foodNutrients: [ { nutrientNumber: '208', unitName: 'KCAL', value: 165 }, { nutrientNumber: '203', value: 31.02 }, { nutrientNumber: '204', value: 3.57 }, { nutrientNumber: '205', value: 0 } ] },
    { fdcId: 2, description: 'Broccoli, raw', dataType: 'Foundation', foodNutrients: [ { nutrientNumber: '958', unitName: 'KCAL', value: 39 }, { nutrientNumber: '203', value: 2.57 }, { nutrientNumber: '204', value: 0.34 }, { nutrientNumber: '205', value: 6.27 } ] },
    { fdcId: 3, description: 'No energy food', foodNutrients: [] }
  ] }), { status: 200 });
}) as any;
process.env.SUPABASE_URL = 'https://x.supabase.co'; process.env.SUPABASE_ANON_KEY = 'anon';
let r = await GET(new Request('https://app/api/usda?q=chicken'));
check('no key -> 503', r.status === 503);
process.env.USDA_API_KEY = 'secret-key';
r = await GET(new Request('https://app/api/usda?q=chicken')); check('no token -> 401', r.status === 401);
r = await GET(new Request('https://app/api/usda?q=chicken', { headers: { Authorization: 'Bearer bad' } })); check('bad token -> 401', r.status === 401);
r = await GET(new Request('https://app/api/usda?q=x', { headers: { Authorization: 'Bearer good' } })); check('short query -> 400', r.status === 400);
r = await GET(new Request('https://app/api/usda?q=chicken%20breast', { headers: { Authorization: 'Bearer good' } }));
const body = await r.json();
check('ok -> 200', r.status === 200);
check('maps SR Legacy kcal 208', body.foods[0].nutrition.kcal === 165 && body.foods[0].nutrition.p === 31, body.foods[0].nutrition);
check('maps Foundation Atwater kcal', body.foods[1].nutrition.kcal === 39 && body.foods[1].nutrition.c === 6.3, body.foods[1].nutrition);
check('drops foods without energy', body.foods.length === 2);
check('key not in response', !JSON.stringify(body).includes('secret-key'));
check('key sent only to USDA', calls.filter((c) => c.includes('secret-key')).every((c) => c.startsWith('https://api.nal.usda.gov/')));
console.log(failures ? `${failures} FAILED` : 'ALL PASSED');
process.exit(failures ? 1 : 0);
