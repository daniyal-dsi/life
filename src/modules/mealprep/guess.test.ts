// Cooked-weight guesses and grams-per-unit defaults. Run with: npm test
import { COOKED, UNIT_DEFAULTS, autoGrams, cookedKind, guessCooked, portionGrams } from './guess.ts';

let failures = 0;
const check = (name: string, ok: boolean, detail: unknown = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail !== '' ? ` - ${JSON.stringify(detail)}` : ''}`);
  if (!ok) failures++;
};

// Meat and fish shrink (~75).
for (const n of ['Chicken, breast, grilled without skin, meat only', 'Beef, mince, stewed', 'Salmon, fillet, baked', 'Lamb, leg joint, roasted, lean', 'Pork chops', 'Prawns, king', 'Chicken thigh'])
  check(`shrinks: ${n}`, guessCooked(n) === 'shrinks');
// Rice, pasta, noodles, couscous, lentils, dried beans, dried grains absorb water (~250).
for (const n of ['Rice, white, basmati, boiled', 'Pasta, white, dried, boiled', 'Penne', 'Noodles, egg, boiled', 'Couscous', 'Lentils, red, split, dried, boiled', 'Beans, chick peas, dried, boiled', 'Quinoa', 'Bulgur wheat', 'Pearl barley'])
  check(`absorbs: ${n}`, guessCooked(n) === 'absorbs');
// Everything else, and tinned or ready-cooked foods, stay the same (100).
for (const n of ['Broccoli, green, boiled', 'Potatoes, old, boiled', 'Tuna, canned in brine, drained', 'Chickpeas, canned, drained', 'Ham, sliced', 'Smoked salmon', 'Greek yoghurt', 'Olive oil'])
  check(`same: ${n}`, guessCooked(n) === 'same');
check('meat aisle shrinks even with an unknown name', guessCooked('Venison something', 'meat') === 'shrinks' && guessCooked('Quorn pieces', 'meat') === 'shrinks');
check('choices are 100 / 75 / 250', COOKED.same.grams === 100 && COOKED.shrinks.grams === 75 && COOKED.absorbs.grams === 250);
check('stored figures map back to a choice', cookedKind(100) === 'same' && cookedKind(75) === 'shrinks' && cookedKind(250) === 'absorbs' && cookedKind(68) === null);

// Unit defaults: clove 5, tsp 5, tbsp 15, cup 240, tin 400, bunch 25; whole has none.
check('defaults', JSON.stringify(UNIT_DEFAULTS) === JSON.stringify({ clove: 5, tsp: 5, tbsp: 15, cup: 240, tin: 400, bunch: 25 }));
check('no default for whole', !('whole' in UNIT_DEFAULTS) && !('whole' in autoGrams()));
check('new ingredient gets the defaults', JSON.stringify(autoGrams()) === JSON.stringify(UNIT_DEFAULTS));

// USDA portions win over defaults; "whole" only comes from the database.
const garlic = portionGrams([{ label: '1 clove', grams: 3 }, { label: '1 cup', grams: 136 }, { label: '1 tsp', grams: 2.8 }]);
check('USDA clove, cup, tsp', garlic.clove === 3 && garlic.cup === 136 && garlic.tsp === 2.8, garlic);
const onion = portionGrams([{ label: '1 large', grams: 150 }, { label: '1 medium (2-1/2" dia)', grams: 110 }, { label: '1 tbsp chopped', grams: 10 }]);
check('whole prefers medium', onion.whole === 110 && onion.tbsp === 10, onion);
check('amounts are divided out', portionGrams([{ label: '2 tbsp', grams: 30 }, { label: '0.5 cup', grams: 60 }]).tbsp === 15 && portionGrams([{ label: '1/2 cup', grams: 60 }]).cup === 120);
const merged = autoGrams([{ label: '1 clove', grams: 3 }, { label: '1 medium', grams: 110 }]);
check('portions override defaults, defaults fill the rest', merged.clove === 3 && merged.whole === 110 && merged.tin === 400 && merged.tbsp === 15, merged);
check('saved weights are kept', autoGrams([{ label: '1 clove', grams: 3 }], { clove: 6 }).clove === 6);

console.log(failures ? `${failures} FAILED` : 'ALL PASSED');
process.exit(failures ? 1 : 0);
