import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { appendVersions, currentOf, loadVersions, newVersion, type Current, type Version } from '@/lib/versioned';
import { buildSeed } from './seed';
import { liftStats, type LiftStats } from './stats';
import {
  TABLES,
  type Exercise,
  type ExerciseData,
  type Template,
  type TemplateData,
  type Workout,
  type WorkoutData
} from './types';

type Versions = {
  exercises: Version<ExerciseData>[];
  templates: Version<TemplateData>[];
  workouts: Version<WorkoutData>[];
};

type LiftLogState = {
  loading: boolean;
  error: string | null;
  exercises: Exercise[];
  templates: Template[];
  workouts: Workout[];
  stats: LiftStats;
  hasSample: boolean;
  saveExercise: (data: ExerciseData, id?: string) => Promise<string>;
  deleteExercise: (id: string) => Promise<void>;
  saveTemplate: (data: TemplateData, id?: string) => Promise<string>;
  deleteTemplate: (id: string) => Promise<void>;
  saveWorkout: (data: WorkoutData, id?: string) => Promise<string>;
  deleteWorkout: (id: string) => Promise<void>;
  clearSample: () => Promise<number>;
};

const EMPTY: Versions = { exercises: [], templates: [], workouts: [] };
const Ctx = createContext<LiftLogState | null>(null);

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

export function LiftLogProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [versions, setVersions] = useState<Versions>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        let [exercises, templates, workouts] = await Promise.all([
          loadVersions<ExerciseData>(TABLES.exercises, userId),
          loadVersions<TemplateData>(TABLES.templates, userId),
          loadVersions<WorkoutData>(TABLES.workouts, userId)
        ]);
        // First visit: add the starter library, templates and sample history.
        if (exercises.length === 0) {
          const seed = await buildSeed(userId);
          await appendVersions(TABLES.exercises, userId, seed.exercises);
          await appendVersions(TABLES.templates, userId, seed.templates);
          await appendVersions(TABLES.workouts, userId, seed.workouts);
          [exercises, templates, workouts] = await Promise.all([
            loadVersions<ExerciseData>(TABLES.exercises, userId),
            loadVersions<TemplateData>(TABLES.templates, userId),
            loadVersions<WorkoutData>(TABLES.workouts, userId)
          ]);
        }
        if (!cancelled) setVersions({ exercises, templates, workouts });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load Lift Log.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const add = useCallback(
    async <K extends keyof Versions>(key: K, rows: Versions[K]) => {
      if (!userId) throw new Error('Not signed in.');
      await appendVersions(TABLES[key], userId, rows as Version<unknown>[]);
      setVersions((v) => ({ ...v, [key]: [...v[key], ...rows] }));
    },
    [userId]
  );

  const exercises = useMemo(() => currentOf(versions.exercises).sort(byName), [versions.exercises]);
  const templates = useMemo(() => currentOf(versions.templates).sort(byName), [versions.templates]);
  const workouts = useMemo(() => currentOf(versions.workouts), [versions.workouts]);
  const stats = useMemo(() => liftStats(workouts, exercises), [workouts, exercises]);

  const value = useMemo<LiftLogState>(() => {
    const save =
      <K extends keyof Versions>(key: K) =>
      async (data: Versions[K][number]['data'], id?: string) => {
        const entityId = id ?? crypto.randomUUID();
        await add(key, [newVersion(userId!, entityId, data)] as Versions[K]);
        return entityId;
      };
    const remove =
      <K extends keyof Versions>(key: K, list: { id: string }[]) =>
      async (id: string) => {
        const cur = list.find((x) => x.id === id) as Current<object> | undefined;
        if (!cur) return;
        // The deletion marker keeps the last data, so history shows what was removed.
        await add(key, [newVersion(userId!, id, dataOf(cur), true)] as Versions[K]);
      };
    return {
      loading,
      error,
      exercises,
      templates,
      workouts,
      stats,
      hasSample: workouts.some((w) => w.sample),
      saveExercise: save('exercises'),
      deleteExercise: remove('exercises', exercises),
      saveTemplate: save('templates'),
      deleteTemplate: remove('templates', templates),
      saveWorkout: save('workouts'),
      deleteWorkout: remove('workouts', workouts),
      async clearSample() {
        const sample = workouts.filter((w) => w.sample);
        await add(
          'workouts',
          sample.map((w) => newVersion(userId!, w.id, dataOf<WorkoutData>(w), true))
        );
        return sample.length;
      }
    };
  }, [loading, error, exercises, templates, workouts, stats, add, userId]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** The stored data of a current entity, without its id and dates. */
function dataOf<T extends object>(c: Current<T>): T {
  const { id: _id, created_at: _c, updated_at: _u, ...data } = c;
  return data as unknown as T;
}

export function useLiftLog(): LiftLogState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useLiftLog must be used inside <LiftLogProvider>');
  return ctx;
}
