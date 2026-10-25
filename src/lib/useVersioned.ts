import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './auth';
import { appendVersions, loadVersions, type Version } from './versioned';

// Loads a module's versioned tables for the signed-in person, seeds starter
// data on first use, and appends new versions. Each module wraps this in its
// own store (see modules/liftlog/store.tsx).

export type VersionSets<K extends string> = Record<K, Version<unknown>[]>;

export function useVersionedTables<K extends string>(
  tables: Record<K, string>,
  options: {
    /** True when this person has never used the module (decides seeding). */
    needsSeed: (v: VersionSets<K>) => boolean;
    seed: (userId: string) => Promise<Partial<VersionSets<K>>>;
  }
) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const keys = Object.keys(tables) as K[];
  const empty = Object.fromEntries(keys.map((k) => [k, []])) as unknown as VersionSets<K>;
  const [versions, setVersions] = useState<VersionSets<K>>(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const loadAll = async () =>
      Object.fromEntries(
        await Promise.all(keys.map(async (k) => [k, await loadVersions<unknown>(tables[k], userId)] as const))
      ) as VersionSets<K>;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        let v = await loadAll();
        if (options.needsSeed(v)) {
          const seed = await options.seed(userId);
          for (const k of keys) if (seed[k]?.length) await appendVersions(tables[k], userId, seed[k]!);
          v = await loadAll();
        }
        if (!cancelled) setVersions(v);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load your data.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Tables and options are module constants.
  }, [userId]);

  const append = useCallback(
    async (key: K, rows: Version<unknown>[]) => {
      if (!userId) throw new Error('Not signed in.');
      if (!rows.length) return;
      await appendVersions(tables[key], userId, rows);
      setVersions((v) => ({ ...v, [key]: [...v[key], ...rows] }));
    },
    // `tables` is a module constant, so only the user matters.
    [userId]
  );

  return { userId, versions, loading, error, append };
}

/** The stored data of a current entity, without its id and dates. */
export function dataOf<T extends object>(c: T & { id: string; created_at: string; updated_at: string }): T {
  const { id: _id, created_at: _c, updated_at: _u, ...data } = c;
  return data as unknown as T;
}
