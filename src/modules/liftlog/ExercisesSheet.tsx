import { useState, type FormEvent } from 'react';
import { Trash2 } from 'lucide-react';
import { BottomSheet, Button, Field, Notice, inputClass } from '@/components/ui';
import { useLiftLog } from './store';
import { GROUPS, type MuscleGroup } from './types';

export default function ExercisesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { exercises, workouts, templates, saveExercise, deleteExercise } = useLiftLog();
  const [name, setName] = useState('');
  const [group, setGroup] = useState<MuscleGroup>('chest');
  const [error, setError] = useState<string | null>(null);

  const used = new Set([
    ...workouts.flatMap((w) => w.entries.map((e) => e.exercise_id)),
    ...templates.flatMap((t) => t.items.map((i) => i.exercise_id))
  ]);

  async function add(e: FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return setError('Give the exercise a name.');
    if (exercises.some((x) => x.name.toLowerCase() === n.toLowerCase())) return setError('You already have that exercise.');
    try {
      await saveExercise({ name: n, group, custom: true });
      setName('');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the exercise.');
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Exercises">
      <div className="flex flex-col gap-5">
        <form onSubmit={add} className="flex flex-col gap-3 rounded-card border border-line bg-bg p-4">
          <p className="font-extrabold">Add your own exercise</p>
          <Field label="Name">
            {(id) => (
              <input
                id={id}
                value={name}
                maxLength={60}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Hip thrust"
                autoComplete="off"
                className={inputClass}
              />
            )}
          </Field>
          <Field label="Muscle group">
            {(id) => (
              <select id={id} value={group} onChange={(e) => setGroup(e.target.value as MuscleGroup)} className={inputClass}>
                {GROUPS.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          {error && <Notice tone="rose">{error}</Notice>}
          <Button type="submit" variant="coral">
            Add exercise
          </Button>
        </form>

        {GROUPS.map((g) => {
          const list = exercises.filter((e) => e.group === g.id);
          if (!list.length) return null;
          return (
            <div key={g.id}>
              <p className="mb-1.5 text-[13px] font-extrabold text-muted">{g.label}</p>
              <ul className="divide-y divide-line rounded-card border border-line bg-surface">
                {list.map((e) => (
                  <li key={e.id} className="flex min-h-[48px] items-center gap-2 py-1 pl-4 pr-1">
                    <span className="flex-1 font-semibold">
                      {e.name}
                      {e.custom && <span className="text-[13px] font-normal text-muted"> · yours</span>}
                    </span>
                    {e.custom && (
                      <button
                        type="button"
                        aria-label={`Delete ${e.name}`}
                        title={used.has(e.id) ? 'Used in a workout or template' : undefined}
                        disabled={used.has(e.id)}
                        onClick={() => void deleteExercise(e.id)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-ctl text-muted"
                      >
                        <Trash2 size={16} aria-hidden />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </BottomSheet>
  );
}
