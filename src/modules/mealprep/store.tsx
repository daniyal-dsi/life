import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useHousehold } from '@/lib/household';
import { dataOf, useVersionedTables } from '@/lib/useVersioned';
import { currentOf, newVersion, type Version } from '@/lib/versioned';
import { buildSeed } from './seed';
import { TABLES, type Ingredient, type IngredientData, type Meal, type MealData } from './types';

type Key = keyof typeof TABLES;

type MealPrepState = {
  loading: boolean;
  error: string | null;
  ingredients: Ingredient[];
  meals: Meal[];
  saveIngredient: (d: IngredientData, id?: string) => Promise<string>;
  deleteIngredient: (id: string) => Promise<void>;
  saveMeal: (d: MealData, id?: string) => Promise<string>;
  deleteMeal: (id: string) => Promise<void>;
};

const Ctx = createContext<MealPrepState | null>(null);
const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

export function MealPrepProvider({ children }: { children: ReactNode }) {
  const { household } = useHousehold();
  const options = useMemo(
    () => ({
      householdId: household?.id ?? null,
      needsSeed: (v: Record<Key, Version<unknown>[]>) => v.ingredients.length === 0,
      seed: (uid: string, hid?: string) => buildSeed(uid, hid!)
    }),
    [household?.id]
  );
  const { userId, versions, loading, error, append } = useVersionedTables(TABLES, options);

  const ingredients = useMemo(() => currentOf(versions.ingredients as Version<IngredientData>[]).sort(byName), [versions.ingredients]);
  const meals = useMemo(() => currentOf(versions.meals as Version<MealData>[]).sort(byName), [versions.meals]);

  const value = useMemo<MealPrepState>(() => {
    const save =
      <T,>(key: Key) =>
      async (data: T, id?: string) => {
        const entityId = id ?? crypto.randomUUID();
        await append(key, [newVersion(userId!, entityId, data)]);
        return entityId;
      };
    const remove = (key: Key, list: Ingredient[] | Meal[]) => async (id: string) => {
      const cur = (list as { id: string; created_at: string; updated_at: string }[]).find((x) => x.id === id);
      if (cur) await append(key, [newVersion(userId!, id, dataOf(cur), true)]);
    };
    return {
      loading,
      error,
      ingredients,
      meals,
      saveIngredient: save<IngredientData>('ingredients'),
      async deleteIngredient(id) {
        if (meals.some((m) => m.lines.some((l) => l.ingredient_id === id))) throw new Error('Remove it from your meals first.');
        await remove('ingredients', ingredients)(id);
      },
      saveMeal: save<MealData>('meals'),
      deleteMeal: remove('meals', meals)
    };
  }, [loading, error, ingredients, meals, append, userId]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMealPrep(): MealPrepState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useMealPrep must be used inside <MealPrepProvider>');
  return ctx;
}
