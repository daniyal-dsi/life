// Search quality checks against the real CoFID file. Run with: npm test
import { readFileSync } from 'node:fs';
import { searchFoods } from './cofid.ts';
import { friendlyName, guessAisle, guessCooked, type FoodResult } from './types.ts';

const raw = JSON.parse(readFileSync(new URL('../../../../public/data/cofid-2021.json', import.meta.url), 'utf8'));
const foods: FoodResult[] = raw.foods.map(([ref, name, group, kcal, p, c, f]: [string, string, string, number, number, number, number]) => ({
  source: 'CoFID',
  ref,
  name,
  group,
  nutrition: { kcal, p, c, f }
}));

let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
  if (!ok) failures++;
};
const names = (q: string, n = 12) => searchFoods(foods, q, n).map((r) => r.name);

check('file has ~2,850 foods', foods.length > 2800, String(foods.length));
check('chicken breast grilled found', names('chicken breast grilled').includes('Chicken, breast, grilled without skin, meat only'));
check('tuna in brine first', names('tuna brine', 1)[0] === 'Tuna, canned in brine, drained');
check('UK spelling yoghurt finds yogurt', names('greek yoghurt').some((n) => n.startsWith('Yogurt, Greek style')));
check('pasta shapes find pasta', names('penne').some((n) => n.startsWith('Pasta, white, dried, boiled')));
check('chickpeas find chick peas, not chicken', names('chickpeas').every((n) => /chick pea/i.test(n)));
check('every word must match', names('broccoli chocolate').length === 0);
check('blank search returns nothing', names('  ').length === 0);

const chicken = searchFoods(foods, 'chicken breast grilled without skin', 1)[0];
check('meat aisle from CoFID group', guessAisle(chicken) === 'meat');
check('grilled meat cooked weight 75', guessCooked(chicken, 'meat') === 75);
const rice = searchFoods(foods, 'basmati boiled', 1)[0];
check('boiled rice cooked weight 250', guessCooked(rice, guessAisle(rice)) === 250);
check('friendly name', friendlyName('Chicken, breast, grilled without skin, meat only') === 'Chicken breast (grilled without skin, meat only)');

console.log(failures ? `${failures} FAILED` : 'ALL PASSED');
process.exit(failures ? 1 : 0);
