import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { currentOf, newVersion, type Version } from '@/lib/versioned';
import { dataOf, useVersionedTables } from '@/lib/useVersioned';
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

const Ctx = createContext<LiftLogState | null>(null);
const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
const OPTIONS = {
  // First visit: add the starter library, templates and sample history.
  needsSeed: (v: Record<keyof typeof TABLES, Version<unknown>[]>) => v.exercises.length === 0,
  seed: (uid: string) => buildSeed(uid)
};

export function LiftLogProvider({ children }: { children: ReactNode }) {
  const { userId, versions, loading, error, append } = useVersionedTables(TABLES, OPTIONS);

  const exercises = useMemo(
    () => currentOf(versions.exercises as Version<ExerciseData>[]).sort(byName),
    [versions.exercises]
  );
  const templates = useMemo(
    () => currentOf(versions.templates as Version<TemplateData>[]).sort(byName),
    [versions.templates]
  );
  const workouts = useMemo(() => currentOf(versions.workouts as Version<WorkoutData>[]), [versions.workouts]);
  const stats = useMemo(() => liftStats(workouts, exercises), [workouts, exercises]);

  const value = useMemo<LiftLogState>(() => {
    const save =
      <T,>(key: keyof typeof TABLES) =>
      async (data: T, id?: string) => {
        const entityId = id ?? crypto.randomUUID();
        await append(key, [newVersion(userId!, entityId, data)]);
        return entityId;
      };
    const remove =
      (key: keyof typeof TABLES, list: { id: string; created_at: string; updated_at: string }[]) =>
      async (id: string) => {
        const cur = list.find((x) => x.id === id);
        // The deletion marker keeps the last data, so history shows what was removed.
        if (cur) await append(key, [newVersion(userId!, id, dataOf(cur), true)]);
      };
    return {
      loading,
      error,
      exercises,
      templates,
      workouts,
      stats,
      hasSample: workouts.some((w) => w.sample),
      saveExercise: save<ExerciseData>('exercises'),
      deleteExercise: remove('exercises', exercises),
      saveTemplate: save<TemplateData>('templates'),
      deleteTemplate: remove('templates', templates),
      saveWorkout: save<WorkoutData>('workouts'),
      deleteWorkout: remove('workouts', workouts),
      async clearSample() {
        const sample = workouts.filter((w) => w.sample);
        await append(
          'workouts',
          sample.map((w) => newVersion(userId!, w.id, dataOf<WorkoutData>(w), true))
        );
        return sample.length;
      }
    };
  }, [loading, error, exercises, templates, workouts, stats, append, userId]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLiftLog(): LiftLogState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useLiftLog must be used inside <LiftLogProvider>');
  return ctx;
}
