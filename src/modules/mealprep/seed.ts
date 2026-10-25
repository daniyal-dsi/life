import { stableId, type Version } from '@/lib/versioned';
import type { Aisle, IngredientData, Line, MealData, MealType, Source, Unit } from './types';

// The household's starting library: the seven meals from "Meal Planning.xlsx"
// and their ingredients. Names follow the brief: plain "Chicken" is chicken
// breast, "pepper" is bell pepper except Chickpea Salad's black pepper, and
// Veg, Tuna and Greek yoghurt are flagged to pick a type. Nutrition values are
// starter values (marked `starter`) to confirm against the food databases.
// Ids come from the household id, so either person can seed it safely.

type Row = [key: string, name: string, aisle: Aisle, staple: boolean, cooked: number, grams: Partial<Record<Unit, number>>, n: [number, number, number, number], source: Source, sourceName: string, ask?: string];

const INGREDIENTS: Row[] = [
  ['chk', 'Chicken breast', 'meat', false, 75, {}, [148, 32, 0, 2.2], 'CoFID', 'Chicken breast, grilled, without skin'],
  ['bef', 'Beef mince (5% fat)', 'meat', false, 70, {}, [174, 27, 0, 7.3], 'CoFID', 'Beef mince, extra lean (5% fat), stewed'],
  ['pot', 'Potatoes', 'veg', false, 100, {}, [72, 1.8, 17, 0.1], 'CoFID', 'Potatoes, old, boiled in unsalted water'],
  ['veg', 'Veg', 'veg', false, 100, {}, [42, 3.3, 6.6, 0.5], 'CoFID', 'Mixed vegetables, frozen, boiled', 'Your sheet just says "Veg". Which veg is it? Macros assume frozen mixed veg for now.'],
  ['tun', 'Tuna', 'cupboard', false, 100, { tin: 112 }, [109, 25, 0, 1], 'CoFID', 'Tuna, canned in brine, drained', 'In brine, spring water or oil? Oil adds a lot of fat. Macros assume brine for now.'],
  ['jal', 'Jalapeños', 'cupboard', false, 100, { tbsp: 15 }, [27, 0.9, 4.7, 0.9], 'USDA', 'Jalapeño peppers, pickled'],
  ['mus', 'Mustard', 'spice', true, 100, { tbsp: 15 }, [139, 7.1, 9.7, 8.2], 'CoFID', 'Mustard, smooth'],
  ['may', 'Light mayo', 'spice', false, 100, { tbsp: 15 }, [260, 0.7, 8.2, 25], 'CoFID', 'Mayonnaise, reduced calorie'],
  ['ghe', 'Gherkins', 'cupboard', false, 100, {}, [14, 0.5, 2.5, 0.1], 'CoFID', 'Gherkins, pickled'],
  ['let', 'Lettuce', 'veg', false, 100, {}, [15, 1, 1.7, 0.3], 'CoFID', 'Lettuce, raw'],
  ['crn', 'Corn', 'cupboard', false, 100, { cup: 165 }, [79, 2.9, 13.7, 1.2], 'CoFID', 'Sweetcorn, canned, drained'],
  ['oni', 'Red onion', 'veg', false, 100, { whole: 110 }, [36, 1.2, 7.9, 0.2], 'CoFID', 'Onions, raw'],
  ['pep', 'Bell pepper', 'veg', false, 100, { whole: 160 }, [32, 1, 6.4, 0.4], 'CoFID', 'Peppers, red, raw'],
  ['yog', 'Greek yoghurt', 'dairy', false, 100, { tbsp: 20 }, [57, 10.3, 3.6, 0.2], 'CoFID', 'Greek yoghurt, 0% fat', 'Which Greek yoghurt: 0% fat, 2% or full fat? Macros assume 0% for now.'],
  ['opw', 'Onion powder', 'spice', true, 100, { tsp: 2.5 }, [341, 10.4, 79, 1], 'USDA', 'Onion powder'],
  ['gpw', 'Garlic powder', 'spice', true, 100, { tsp: 3 }, [331, 16.6, 72.7, 0.7], 'USDA', 'Garlic powder'],
  ['lem', 'Lemon juice', 'cupboard', false, 100, { tbsp: 15 }, [22, 0.4, 6.9, 0.2], 'USDA', 'Lemon juice, raw'],
  ['fet', 'Feta cheese', 'dairy', false, 100, { cup: 150 }, [250, 15.6, 1.5, 20.2], 'CoFID', 'Feta cheese'],
  ['cuc', 'Cucumber', 'veg', false, 100, { whole: 300 }, [10, 0.7, 1.5, 0.1], 'CoFID', 'Cucumber, raw'],
  ['tom', 'Cherry tomatoes', 'veg', false, 100, {}, [18, 0.9, 3.1, 0.3], 'CoFID', 'Tomatoes, cherry, raw'],
  ['chp', 'Chickpeas', 'cupboard', false, 100, { tin: 240 }, [115, 7.2, 16.1, 2.9], 'CoFID', 'Chickpeas, canned, drained'],
  ['lim', 'Lime juice', 'cupboard', false, 100, { tbsp: 15 }, [25, 0.4, 8.4, 0.1], 'USDA', 'Lime juice, raw'],
  ['blp', 'Black pepper', 'spice', true, 100, { tsp: 2.3 }, [255, 10.4, 64, 3.3], 'CoFID', 'Pepper, black'],
  ['slt', 'Salt', 'spice', true, 100, { tsp: 6 }, [0, 0, 0, 0], 'CoFID', 'Salt'],
  ['evm', 'Evaporated milk', 'dairy', false, 100, {}, [160, 8.2, 11.3, 9.4], 'CoFID', 'Evaporated milk, whole'],
  ['pas', 'Tomato passata', 'cupboard', false, 100, {}, [29, 1.4, 5, 0.2], 'CoFID', 'Passata'],
  ['stk', 'Chicken stock', 'cupboard', true, 100, {}, [5, 0.6, 0.4, 0.2], 'CoFID', 'Stock cubes, chicken, made up'],
  ['crc', 'Light cream cheese', 'dairy', false, 100, {}, [150, 7.5, 4.5, 11], 'CoFID', 'Soft cheese, light'],
  ['par', 'Parmesan', 'dairy', false, 100, {}, [415, 36.2, 0.9, 29.7], 'CoFID', 'Parmesan cheese, fresh'],
  ['gar', 'Garlic', 'veg', false, 100, { clove: 4 }, [98, 7.9, 16.3, 0.6], 'CoFID', 'Garlic, raw'],
  ['lbt', 'Light butter', 'dairy', false, 100, {}, [540, 0.5, 0.6, 60], 'CoFID', 'Butter spread, lighter (60% fat)'],
  ['cor', 'Coriander', 'veg', false, 100, { bunch: 30 }, [23, 2.1, 3.7, 0.5], 'CoFID', 'Coriander leaves, fresh']
];

// [key, name, type, lines: [ingredient, qty, unit]] from the "Ingredients" sheet.
const MEALS: [string, string, MealType, [string, number | null, Unit][]][] = [
  ['tuna', 'Tuna Salad', 'lunch', [['tun', 1, 'tin'], ['jal', 20, 'g'], ['mus', 1, 'tbsp'], ['may', 1, 'tbsp'], ['ghe', 20, 'g'], ['let', 50, 'g']]],
  ['chickpea', 'Chickpea Salad', 'lunch', [['cuc', null, 'whole'], ['tom', null, 'g'], ['pep', null, 'whole'], ['crn', null, 'cup'], ['chp', null, 'tin'], ['yog', null, 'tbsp'], ['lim', null, 'tbsp'], ['gpw', null, 'tsp'], ['blp', null, 'tsp'], ['slt', null, 'tsp']]],
  ['chicken-salad', 'Chicken Salad', 'dinner', [['chk', 150, 'g'], ['crn', 1, 'cup'], ['oni', 1, 'whole'], ['pep', 1, 'whole'], ['jal', 1.5, 'tbsp'], ['yog', 2, 'tbsp'], ['may', 1, 'tbsp'], ['opw', 0.5, 'tsp'], ['gpw', 0.5, 'tsp'], ['lem', 1.5, 'tbsp'], ['fet', 0.25, 'cup'], ['cuc', 1, 'whole']]],
  ['beef-potato-veg', 'Beef + Potato + Veg', 'dinner', [['bef', 250, 'g'], ['pot', 200, 'g'], ['veg', 200, 'g']]],
  ['chicken-potato-veg', 'Chicken + Potato + Veg', 'dinner', [['chk', 250, 'g'], ['pot', 200, 'g'], ['veg', 200, 'g']]],
  ['lamb-bhuna', 'Lamb Bhuna + Rice + Veg', 'dinner', []],
  ['chicken-pasta', 'Chicken Pasta', 'dinner', [['chk', 162.5, 'g'], ['evm', 50, 'ml'], ['pas', 25, 'g'], ['stk', 30, 'ml'], ['crc', 20, 'g'], ['par', 10, 'g'], ['gar', 1, 'clove'], ['lbt', 3.75, 'g'], ['cor', 1, 'bunch']]]
];

export async function buildSeed(userId: string, householdId: string) {
  const id = (key: string) => stableId(`${householdId}:mealprep:${key}`);
  const now = Date.now();
  const v = async <T,>(key: string, data: T, i: number): Promise<Version<T>> => ({
    id: await id(`${key}:v1`),
    entity_id: await id(key),
    user_id: userId,
    household_id: householdId,
    data,
    deleted: false,
    created_at: new Date(now + i).toISOString()
  });

  const ingredients = await Promise.all(
    INGREDIENTS.map(([key, name, aisle, staple, cooked, grams, [kcal, p, c, f], source, sourceName, ask], i) =>
      v<IngredientData>(
        `ingredient:${key}`,
        {
          name,
          aisle,
          staple,
          cooked_per_100g_raw: cooked,
          grams_per: grams,
          nutrition: { kcal, p, c, f },
          source,
          source_name: sourceName,
          starter: true,
          ask: ask ?? null
        },
        i
      )
    )
  );
  const meals = await Promise.all(
    MEALS.map(async ([key, name, type, lines], i) =>
      v<MealData>(
        `meal:${key}`,
        {
          name,
          type,
          link: null,
          lines: await Promise.all(
            lines.map(async ([ing, qty, unit], j): Promise<Line> => ({ key: await id(`meal:${key}:line:${j}`), ingredient_id: await id(`ingredient:${ing}`), qty, unit }))
          )
        },
        100 + i
      )
    )
  );
  return { ingredients, meals };
}
