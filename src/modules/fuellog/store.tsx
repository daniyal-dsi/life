import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { currentOf, newVersion, stableId, type Version } from '@/lib/versioned';
import { dataOf, useVersionedTables } from '@/lib/useVersioned';
import { buildSeed } from './seed';
import { profileOn, targets, type Targets } from './targets';
import {
  TABLES,
  type Entry,
  type EntryData,
  type Food,
  type FoodData,
  type ProfileData,
  type WeightData,
  type WeightEntry
} from './types';

type FuelLogState = {
  loading: boolean;
  error: string | null;
  /** Current profile (newest version), or null before setup. */
  profile: ProfileData | null;
  targetsOn: (date: string) => Targets | null;
  foods: Food[];
  entries: Entry[];
  weights: WeightEntry[];
  hasSample: boolean;
  saveProfile: (p: ProfileData) => Promise<void>;
  saveFood: (data: FoodData, id?: string) => Promise<string>;
  deleteFood: (id: string) => Promise<void>;
  saveEntry: (data: EntryData, id?: string) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  /** One weight per date: logging a date again replaces it (as a new version). */
  saveWeight: (data: WeightData) => Promise<void>;
  deleteWeight: (id: string) => Promise<void>;
  clearSample: () => Promise<void>;
};

const Ctx = createContext<FuelLogState | null>(null);
type Key = keyof typeof TABLES;
const OPTIONS = {
  needsSeed: (v: Record<Key, Version<unknown>[]>) => v.profile.length === 0,
  seed: buildSeed
};

export function FuelLogProvider({ children }: { children: ReactNode }) {
  const { userId, versions, loading, error, append } = useVersionedTables(TABLES, OPTIONS);
  const profileVersions = versions.profile as Version<ProfileData>[];

  const profile = useMemo(() => currentOf(profileVersions)[0] ?? null, [profileVersions]);
  const foods = useMemo(
    () => currentOf(versions.foods as Version<FoodData>[]).sort((a, b) => a.name.localeCompare(b.name)),
    [versions.foods]
  );
  const entries = useMemo(() => currentOf(versions.entries as Version<EntryData>[]), [versions.entries]);
  const weights = useMemo(
    () =>
      currentOf(versions.weights as Version<WeightData>[]).sort((a, b) =>
        a.date === b.date ? a.updated_at.localeCompare(b.updated_at) : a.date < b.date ? -1 : 1
      ),
    [versions.weights]
  );

  const value = useMemo<FuelLogState>(() => {
    const add = (key: Key, entityId: string, data: unknown, deleted = false) =>
      append(key, [newVersion(userId!, entityId, data, deleted)]);
    const remove = (key: Key, list: { id: string; created_at: string; updated_at: string }[]) => async (id: string) => {
      const cur = list.find((x) => x.id === id);
      if (cur) await add(key, id, dataOf(cur), true);
    };
    const profileData = profile ? dataOf<ProfileData>(profile) : null;
    return {
      loading,
      error,
      profile: profileData,
      targetsOn: (date) => {
        const p = profileOn(profileVersions, date);
        return p ? targets(p) : null;
      },
      foods,
      entries,
      weights,
      hasSample: entries.some((e) => e.sample) || weights.some((w) => w.sample),
      async saveProfile(p) {
        const { sample: _s, ...rest } = p;
        await add('profile', profile?.id ?? (await stableId(`${userId}:fuellog:profile`)), rest);
      },
      async saveFood(data, id) {
        const entityId = id ?? crypto.randomUUID();
        await add('foods', entityId, data);
        return entityId;
      },
      deleteFood: remove('foods', foods),
      async saveEntry(data, id) {
        await add('entries', id ?? crypto.randomUUID(), data);
      },
      deleteEntry: remove('entries', entries),
      async saveWeight(data) {
        const existing = weights.find((w) => w.date === data.date);
        await add('weights', existing?.id ?? crypto.randomUUID(), { date: data.date, kg: data.kg });
      },
      deleteWeight: remove('weights', weights),
      async clearSample() {
        await append(
          'entries',
          entries.filter((e) => e.sample).map((e) => newVersion(userId!, e.id, dataOf<EntryData>(e), true))
        );
        await append(
          'weights',
          weights.filter((w) => w.sample).map((w) => newVersion(userId!, w.id, dataOf<WeightData>(w), true))
        );
      }
    };
  }, [loading, error, profile, profileVersions, foods, entries, weights, append, userId]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFuelLog(): FuelLogState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useFuelLog must be used inside <FuelLogProvider>');
  return ctx;
}
