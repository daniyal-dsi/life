// Open Food Facts barcode lookup, with the API mocked. Run with: npm test
import { lookupBarcode } from '../src/lib/nutrition/off.ts';

let failures = 0;
const check = (name: string, ok: boolean, detail: unknown = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail !== '' ? ` - ${JSON.stringify(detail)}` : ''}`);
  if (!ok) failures++;
};
const reply = (body: unknown, status = 200) => (globalThis.fetch = (async () => new Response(JSON.stringify(body), { status })) as typeof fetch);

reply({ status: 1, product: { product_name: 'Protein bar', brands: 'Acme', quantity: '4 x 45 g', serving_quantity: 45, serving_quantity_unit: 'g', serving_size: '1 bar (45 g)', nutriments: { 'energy-kcal_100g': 380, proteins_100g: 33.3, carbohydrates_100g: 35, fat_100g: 11.1 } } });
let r = await lookupBarcode('5012345678900');
check('per 100 g values', r?.nutrition.kcal === 380 && r?.nutrition.p === 33.3, r?.nutrition);
check('serving size from the pack', r?.servingGrams === 45 && r?.servingLabel === '1 bar (45 g)', { g: r?.servingGrams, l: r?.servingLabel });

reply({ status: 1, product: { product_name: 'Oat drink', serving_quantity: '250', serving_quantity_unit: 'ml', nutriments: { 'energy-kcal_100g': 45 } } });
r = await lookupBarcode('5012345678901');
check('ml serving counts as grams, label falls back to ml', r?.servingGrams === 250 && r?.servingLabel === '250 ml', { g: r?.servingGrams, l: r?.servingLabel });

reply({ status: 1, product: { product_name: 'Loose apples', nutriments: { energy_100g: 218 } } });
r = await lookupBarcode('5012345678902');
check('no serving size: per 100 g only', r?.servingGrams === undefined && r?.nutrition.kcal === 52, r);

reply({ status: 0 }, 200);
check('unknown product -> null', (await lookupBarcode('5012345678903')) === null);

globalThis.fetch = (async () => {
  throw new TypeError('Failed to fetch');
}) as typeof fetch;
let msg = '';
try {
  await lookupBarcode('5012345678904');
} catch (err) {
  msg = (err as Error).message;
}
check('outage gives a friendly message', /isn't responding/.test(msg), msg);

reply({}, 502);
msg = '';
try {
  await lookupBarcode('5012345678905');
} catch (err) {
  msg = (err as Error).message;
}
check('502 gives the same message', /isn't responding/.test(msg), msg);
let bad = '';
try {
  await lookupBarcode('12');
} catch (err) {
  bad = (err as Error).message;
}
check('short barcode rejected', /8 to 14 digits/.test(bad));

console.log(failures ? `${failures} FAILED` : 'ALL PASSED');
process.exit(failures ? 1 : 0);
