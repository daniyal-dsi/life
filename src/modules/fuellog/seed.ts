import { addDays, toISODate } from '@/lib/date';
import { stableId, type Version } from '@/lib/versioned';
import type { EntryData, FoodData, Meal, ProfileData, WeightData } from './types';

// Starter data: a sample profile, a food library, one fully logged day
// (today) and a few weeks of weigh-ins. Ids come from the user id, so
// seeding twice is harmless.

const FOODS: [string, string, number, number, number, number][] = [
  ['eggs', 'Eggs (1 large)', 78, 6.3, 0.6, 5.3],
  ['porridge', 'Porridge oats with milk', 230, 9, 33, 6],
  ['chicken', 'Chicken breast (150 g)', 248, 46, 0, 5.4],
  ['rice', 'Basmati rice (cooked, 150 g)', 210, 4.4, 46, 0.5],
  ['protein-bar', 'Protein bar', 210, 20, 22, 7],
  ['banana', 'Banana', 105, 1.3, 27, 0.4],
  ['salmon', 'Salmon fillet (120 g)', 250, 25, 0, 16],
  ['broccoli', 'Broccoli (100 g)', 34, 2.8, 7, 0.4],
  ['yoghurt', 'Greek yoghurt (150 g)', 140, 15, 6, 6],
  ['olive-oil', 'Olive oil (1 tbsp)', 119, 0, 0, 13.5]
];

const DAY: [Meal, string, number][] = [
  ['breakfast', 'eggs', 3],
  ['breakfast', 'porridge', 1],
  ['lunch', 'chicken', 1],
  ['lunch', 'rice', 1.5],
  ['dinner', 'salmon', 1],
  ['dinner', 'rice', 1],
  ['dinner', 'broccoli', 1],
  ['snacks', 'protein-bar', 1],
  ['snacks', 'banana', 1]
];

const WEIGHTS: [number, number][] = [
  [-35, 84.1],
  [-28, 83.9],
  [-21, 83.6],
  [-14, 83.4],
  [-7, 83.1],
  [-1, 82.9]
];

export async function buildSeed(userId: string, now = new Date()) {
  const id = (key: string) => stableId(`${userId}:fuellog:${key}`);
  const at = (i: number) => new Date(now.getTime() + i).toISOString();
  const today = toISODate(now);
  const v = async <T,>(key: string, data: T, i: number): Promise<Version<T>> => ({
    id: await id(`${key}:v1`),
    entity_id: await id(key),
    user_id: userId,
    data,
    deleted: false,
    created_at: at(i)
  });

  const profile = [
    await v<ProfileData>(
      'profile',
      { weight_kg: 83, height_cm: 180, age: 30, sex: 'male', activity: 'moderate', goal: 'lose', sample: true },
      0
    )
  ];
  const foodIds: Record<string, string> = {};
  const foods: Version<FoodData>[] = [];
  for (const [i, [slug, name, kcal, p, c, f]] of FOODS.entries()) {
    foodIds[slug] = await id(`food:${slug}`);
    foods.push(await v<FoodData>(`food:${slug}`, { name, kcal, p, c, f }, 10 + i));
  }
  const byslug = Object.fromEntries(FOODS.map((x) => [x[0], x]));
  const entries: Version<EntryData>[] = [];
  for (const [i, [meal, slug, servings]] of DAY.entries()) {
    const [, name, kcal, p, c, f] = byslug[slug];
    entries.push(
      await v<EntryData>(
        `entry:${i}`,
        { date: today, meal, food_id: foodIds[slug], servings, name, kcal, p, c, f, sample: true },
        100 + i
      )
    );
  }
  const weights: Version<WeightData>[] = [];
  for (const [i, [offset, kg]] of WEIGHTS.entries()) {
    weights.push(await v<WeightData>(`weight:${i}`, { date: toISODate(addDays(now, offset)), kg, sample: true }, 200 + i));
  }
  return { profile, foods, entries, weights };
}
