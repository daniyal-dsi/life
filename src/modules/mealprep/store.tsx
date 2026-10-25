import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { addDays, fromISODate, toISODate } from '@/lib/date';
import { useHousehold } from '@/lib/household';
import { dataOf, useVersionedTables } from '@/lib/useVersioned';
import { currentOf, newVersion, stableId, type Version } from '@/lib/versioned';
import { buildSeed } from './seed';
import { weekDates } from './plan';
import {
  TABLES,
  type Ingredient,
  type IngredientData,
  type Meal,
  type MealData,
  type MealType,
  type PlanData,
  type PlanEntry,
  type ShopData,
  type ShopRow
} from './types';

type Key = keyof typeof TABLES;

type MealPrepState = {
  loading: boolean;
  error: string | null;
  householdId: string | null;
  ingredients: Ingredient[];
  meals: Meal[];
  plan: PlanEntry[];
  shopping: ShopRow[];
  saveIngredient: (d: IngredientData, id?: string) => Promise<string>;
  deleteIngredient: (id: string) => Promise<void>;
  saveMeal: (d: MealData, id?: string) => Promise<string>;
  deleteMeal: (id: string) => Promise<void>;
  /** Puts a meal in a slot (replacing what was there). */
  setSlot: (date: string, slot: MealType, mealId: string, eaters: string[]) => Promise<void>;
  clearSlot: (date: string, slot: MealType) => Promise<void>;
  /** Copies the previous week's plan into this one, replacing it. */
  copyLastWeek: (monday: string) => Promise<number>;
  clearWeek: (monday: string) => Promise<void>;
  tickItem: (week: string, ingredientId: string, done: boolean) => Promise<void>;
  setItemAmount: (week: string, ingredientId: string, amount: string | null) => Promise<void>;
  addExtra: (week: string, name: string) => Promise<void>;
  tickExtra: (id: string, done: boolean) => Promise<void>;
  removeExtra: (id: string) => Promise<void>;
  untickAll: (week: string) => Promise<void>;
  refresh: () => void;
};

const Ctx = createContext<MealPrepState | null>(null);
const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

export function MealPrepProvider({ children }: { children: ReactNode }) {
  const { household } = useHousehold();
  const householdId = household?.id ?? null;
  const options = useMemo(
    () => ({
      householdId,
      needsSeed: (v: Record<Key, Version<unknown>[]>) => v.ingredients.length === 0,
      seed: (uid: string, hid?: string) => buildSeed(uid, hid!)
    }),
    [householdId]
  );
  const { userId, versions, loading, error, append, reload } = useVersionedTables(TABLES, options);

  // Shared data: pick up the other person's changes when coming back to the app.
  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && reload();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [reload]);

  const ingredients = useMemo(() => currentOf(versions.ingredients as Version<IngredientData>[]).sort(byName), [versions.ingredients]);
  const meals = useMemo(() => currentOf(versions.meals as Version<MealData>[]).sort(byName), [versions.meals]);
  const plan = useMemo(() => currentOf(versions.plan as Version<PlanData>[]), [versions.plan]);
  const shopping = useMemo(() => currentOf(versions.shopping as Version<ShopData>[]), [versions.shopping]);

  const value = useMemo<MealPrepState>(() => {
    const ver = (id: string, data: unknown, deleted = false) => newVersion(userId!, id, data, deleted);
    const save =
      <T,>(key: Key) =>
      async (data: T, id?: string) => {
        const entityId = id ?? crypto.randomUUID();
        await append(key, [ver(entityId, data)]);
        return entityId;
      };
    const slotId = (date: string, slot: MealType) => stableId(`${householdId}:mealprep:plan:${date}:${slot}`);
    const itemId = (week: string, ingredientId: string) => stableId(`${householdId}:mealprep:shop:${week}:${ingredientId}`);
    const itemRow = (week: string, ingredientId: string) =>
      shopping.find((r) => r.week === week && r.kind === 'item' && r.ingredient_id === ingredientId) as (ShopRow & { kind: 'item' }) | undefined;
    const inWeek = (monday: string) => {
      const days = new Set(weekDates(monday));
      return plan.filter((p) => days.has(p.date));
    };

    return {
      loading,
      error,
      householdId,
      ingredients,
      meals,
      plan,
      shopping,
      saveIngredient: save<IngredientData>('ingredients'),
      async deleteIngredient(id) {
        if (meals.some((m) => m.lines.some((l) => l.ingredient_id === id))) throw new Error('Remove it from your meals first.');
        const cur = ingredients.find((x) => x.id === id);
        if (cur) await append('ingredients', [ver(id, dataOf(cur), true)]);
      },
      saveMeal: save<MealData>('meals'),
      async deleteMeal(id) {
        const cur = meals.find((x) => x.id === id);
        if (cur) await append('meals', [ver(id, dataOf(cur), true)]);
      },
      async setSlot(date, slot, mealId, eaters) {
        await append('plan', [ver(await slotId(date, slot), { date, slot, meal_id: mealId, eaters } satisfies PlanData)]);
      },
      async clearSlot(date, slot) {
        const cur = plan.find((p) => p.date === date && p.slot === slot);
        if (cur) await append('plan', [ver(cur.id, dataOf(cur), true)]);
      },
      async copyLastWeek(monday) {
        const thisWeek = weekDates(monday);
        const lastWeek = weekDates(toISODate(addDays(fromISODate(monday), -7)));
        const source = plan.filter((p) => lastWeek.includes(p.date));
        const copies = await Promise.all(
          source.map(async (p) => {
            const date = thisWeek[lastWeek.indexOf(p.date)];
            return ver(await slotId(date, p.slot), { date, slot: p.slot, meal_id: p.meal_id, eaters: p.eaters } satisfies PlanData);
          })
        );
        // Clear this week first, so the copy replaces it.
        const copied = new Set(copies.map((c) => c.entity_id));
        const clears = inWeek(monday)
          .filter((p) => !copied.has(p.id))
          .map((p) => ver(p.id, dataOf(p), true));
        await append('plan', [...clears, ...copies]);
        return source.length;
      },
      async clearWeek(monday) {
        await append(
          'plan',
          inWeek(monday).map((p) => ver(p.id, dataOf(p), true))
        );
      },
      async tickItem(week, ingredientId, done) {
        const cur = itemRow(week, ingredientId);
        await append('shopping', [ver(await itemId(week, ingredientId), { week, kind: 'item', ingredient_id: ingredientId, done, amount: cur?.amount ?? null } satisfies ShopData)]);
      },
      async setItemAmount(week, ingredientId, amount) {
        const cur = itemRow(week, ingredientId);
        await append('shopping', [
          ver(await itemId(week, ingredientId), { week, kind: 'item', ingredient_id: ingredientId, done: cur?.done ?? false, amount: amount?.trim() || null } satisfies ShopData)
        ]);
      },
      async addExtra(week, name) {
        await append('shopping', [ver(crypto.randomUUID(), { week, kind: 'extra', name: name.trim(), done: false } satisfies ShopData)]);
      },
      async tickExtra(id, done) {
        const cur = shopping.find((r) => r.id === id);
        if (cur) await append('shopping', [ver(id, { ...(dataOf(cur) as ShopData), done })]);
      },
      async removeExtra(id) {
        const cur = shopping.find((r) => r.id === id);
        if (cur) await append('shopping', [ver(id, dataOf(cur), true)]);
      },
      async untickAll(week) {
        await append(
          'shopping',
          shopping.filter((r) => r.week === week && r.done).map((r) => ver(r.id, { ...(dataOf(r) as ShopData), done: false }))
        );
      },
      refresh: reload
    };
  }, [loading, error, householdId, ingredients, meals, plan, shopping, append, reload, userId]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Meal Prep data when inside its provider, otherwise null (for other modules). */
export function useOptionalMealPrep(): MealPrepState | null {
  return useContext(Ctx);
}

export function useMealPrep(): MealPrepState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useMealPrep must be used inside <MealPrepProvider>');
  return ctx;
}
