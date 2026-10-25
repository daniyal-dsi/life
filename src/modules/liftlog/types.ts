import type { Current } from '@/lib/versioned';

export const TABLES = {
  exercises: 'liftlog_exercises',
  templates: 'liftlog_templates',
  workouts: 'liftlog_workouts'
} as const;

export type MuscleGroup = 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'core';

/** Display order of muscle groups in lists. */
export const GROUPS: { id: MuscleGroup; label: string }[] = [
  { id: 'chest', label: 'Chest' },
  { id: 'back', label: 'Back' },
  { id: 'legs', label: 'Legs' },
  { id: 'shoulders', label: 'Shoulders' },
  { id: 'arms', label: 'Arms' },
  { id: 'core', label: 'Core' }
];

export const GROUP_LABEL = Object.fromEntries(GROUPS.map((g) => [g.id, g.label])) as Record<MuscleGroup, string>;

export type ExerciseData = { name: string; group: MuscleGroup; custom: boolean };
export type TemplateItem = { exercise_id: string; sets: number; reps: number };
export type TemplateData = { name: string; items: TemplateItem[] };
export type SetEntry = { w: number; r: number };
export type WorkoutEntry = { exercise_id: string; sets: SetEntry[] };
export type WorkoutData = {
  /** Local date, YYYY-MM-DD. */
  date: string;
  note: string;
  entries: WorkoutEntry[];
  template_id: string | null;
  /** Starter history, removable with "Clear sample workouts". */
  sample?: boolean;
};

export type Exercise = Current<ExerciseData>;
export type Template = Current<TemplateData>;
export type Workout = Current<WorkoutData>;
