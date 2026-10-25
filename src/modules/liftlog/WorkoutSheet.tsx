import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { Badge, BottomSheet, Button, Field, Notice, inputClass } from '@/components/ui';
import { todayISO } from '@/lib/date';
import ExerciseSelect from './ExerciseSelect';
import { kg, shortDate } from './format';
import { lastSets, sortWorkouts, topSetIndex } from './stats';
import { useLiftLog } from './store';
import type { Template, Workout, WorkoutData } from './types';

// Log a new workout or edit one. Sets are typed as text and checked on save,
// so a half-typed "92." doesn't fight the keyboard.

type DraftSet = { w: string; r: string };
type DraftEntry = { key: string; exercise_id: string; sets: DraftSet[] };
export type Draft = { id?: string; date: string; note: string; template_id: string | null; sample?: boolean; entries: DraftEntry[] };

const key = () => crypto.randomUUID();

export function emptyDraft(): Draft {
  return { date: todayISO(), note: '', template_id: null, entries: [] };
}

export function draftFromWorkout(w: Workout): Draft {
  return {
    id: w.id,
    date: w.date,
    note: w.note,
    template_id: w.template_id,
    sample: w.sample,
    entries: w.entries.map((e) => ({
      key: key(),
      exercise_id: e.exercise_id,
      sets: e.sets.map((s) => ({ w: kg(s.w), r: String(s.r) }))
    }))
  };
}

/** Pre-fills a template's exercises with the weights used last time. */
export function draftFromTemplate(t: Template, workouts: Workout[]): Draft {
  return {
    ...emptyDraft(),
    template_id: t.id,
    entries: t.items.map((item) => {
      const last = lastSets(workouts, item.exercise_id);
      return {
        key: key(),
        exercise_id: item.exercise_id,
        sets: Array.from({ length: Math.max(1, item.sets) }, (_, i) => {
          const prev = last?.sets[Math.min(i, last.sets.length - 1)];
          return { w: prev ? kg(prev.w) : '', r: String(item.reps) };
        })
      };
    })
  };
}

const parseWeight = (s: string) => (s.trim() === '' ? NaN : Number(s.replace(',', '.')));
const parseReps = (s: string) => (s.trim() === '' ? NaN : Number(s));

export default function WorkoutSheet({
  draft: initial,
  onClose
}: {
  draft: Draft | null;
  onClose: () => void;
}) {
  const { exercises, templates, workouts, saveWorkout, deleteWorkout } = useLiftLog();
  const [d, setD] = useState<Draft>(initial ?? emptyDraft());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (initial) {
      setD(initial);
      setError(null);
      setConfirmDelete(false);
    }
  }, [initial]);

  // Best top-set weight per exercise from other workouts on or before this date.
  const bestBefore = useMemo(() => {
    const best: Record<string, number> = {};
    for (const w of [...workouts].sort(sortWorkouts)) {
      if (w.id === d.id || w.date > d.date) continue;
      for (const en of w.entries) {
        const mi = topSetIndex(en.sets);
        if (mi >= 0) best[en.exercise_id] = Math.max(best[en.exercise_id] ?? 0, en.sets[mi].w);
      }
    }
    return best;
  }, [workouts, d.id, d.date]);

  const update = (fn: (d: Draft) => Draft) => setD((cur) => fn(structuredClone(cur)));

  async function save() {
    const entries: WorkoutData['entries'] = [];
    for (const en of d.entries) {
      const sets = [];
      for (const s of en.sets) {
        if (s.w.trim() === '' && s.r.trim() === '') continue;
        const w = parseWeight(s.w);
        const r = parseReps(s.r);
        if (!Number.isFinite(w) || w < 0 || w > 1000) return setError('Each set needs a weight in kg (use 0 for bodyweight).');
        if (!Number.isInteger(r) || r < 1 || r > 500) return setError('Each set needs a whole number of reps.');
        sets.push({ w: Math.round(w * 100) / 100, r });
      }
      if (sets.length) entries.push({ exercise_id: en.exercise_id, sets });
    }
    if (!entries.length) return setError('Add at least one exercise with a set.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) return setError('Pick a date.');
    if (d.date > todayISO()) return setError("The date can't be in the future.");
    setBusy(true);
    setError(null);
    try {
      const data: WorkoutData = { date: d.date, note: d.note.trim(), entries, template_id: d.template_id };
      if (d.sample) data.sample = true;
      await saveWorkout(data, d.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the workout.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!d.id) return;
    if (!confirmDelete) return setConfirmDelete(true);
    setBusy(true);
    try {
      await deleteWorkout(d.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the workout.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet open={!!initial} onClose={onClose} title={d.id ? 'Edit workout' : 'Log workout'}>
      <div className="flex flex-col gap-4">
        <Field label="Date">
          {(id) => (
            <input
              id={id}
              type="date"
              value={d.date}
              max={todayISO()}
              onChange={(e) => update((x) => ({ ...x, date: e.target.value }))}
              className={inputClass}
            />
          )}
        </Field>

        {!d.id && d.entries.length === 0 && templates.length > 0 && (
          <div>
            <p className="mb-1.5 text-[13px] font-semibold text-muted">Start from a template</p>
            <div className="flex flex-wrap gap-2">
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setD({ ...draftFromTemplate(t, workouts), date: d.date })}
                  className="h-10 rounded-ctl bg-coral-soft px-4 text-[14px] font-bold text-coral-ink"
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {d.entries.map((en, i) => {
          const best = bestBefore[en.exercise_id];
          const last = !d.id ? lastSets(workouts, en.exercise_id, d.date) : null;
          const top = topSetIndex(en.sets.map((s) => ({ w: parseWeight(s.w) || 0, r: parseReps(s.r) || 0 })));
          const prIndex = best !== undefined && top >= 0 && parseWeight(en.sets[top].w) > best ? top : -1;
          return (
            <div key={en.key} className="flex flex-col gap-2 rounded-[14px] border border-line bg-bg p-3">
              <div className="flex items-center gap-2">
                <ExerciseSelect
                  label={`Exercise ${i + 1}`}
                  exercises={exercises}
                  value={en.exercise_id}
                  onChange={(v) => update((x) => ((x.entries[i].exercise_id = v), x))}
                />
                <button
                  type="button"
                  aria-label="Remove exercise"
                  onClick={() => update((x) => ((x.entries = x.entries.filter((_, j) => j !== i)), x))}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-ctl text-muted"
                >
                  <Trash2 size={18} aria-hidden />
                </button>
              </div>
              {(best !== undefined || last) && (
                <p className="text-[13px] text-muted">
                  {last && (
                    <>
                      Last time ({shortDate(last.date)}):{' '}
                      <b className="tnum text-ink">{last.sets.map((s) => `${kg(s.w)}×${s.r}`).join(', ')}</b>.{' '}
                    </>
                  )}
                  {best !== undefined && (
                    <>
                      Best <b className="tnum text-ink">{kg(best)} kg</b>; beat it for a PR.
                    </>
                  )}
                </p>
              )}
              <div className="grid grid-cols-[28px_minmax(0,1fr)_16px_minmax(0,1fr)_40px] items-center gap-1.5 text-[12px] font-bold text-muted">
                <span>Set</span>
                <span>Weight (kg)</span>
                <span />
                <span>Reps</span>
                <span />
              </div>
              {en.sets.map((s, j) => {
                const isPR = j === prIndex;
                return (
                  <div key={j} className="grid grid-cols-[28px_minmax(0,1fr)_16px_minmax(0,1fr)_40px] items-center gap-1.5">
                    <span className="text-center text-[13px] font-extrabold">{j + 1}</span>
                    <div className="relative">
                      <input
                        inputMode="decimal"
                        aria-label={`Set ${j + 1} weight`}
                        value={s.w}
                        onChange={(e) => update((x) => ((x.entries[i].sets[j].w = e.target.value), x))}
                        className={`tnum h-11 w-full rounded-ctl border bg-surface px-2 text-center text-[16px] ${isPR ? 'border-sun' : 'border-line2'}`}
                      />
                    </div>
                    <span className="text-center text-muted">×</span>
                    <input
                      inputMode="numeric"
                      aria-label={`Set ${j + 1} reps`}
                      value={s.r}
                      onChange={(e) => update((x) => ((x.entries[i].sets[j].r = e.target.value), x))}
                      className="tnum h-11 w-full rounded-ctl border border-line2 bg-surface px-2 text-center text-[16px]"
                    />
                    {isPR ? (
                      <span className="flex justify-center" title="New personal record">
                        <span className="rounded-[5px] bg-sun px-1 text-[10px] font-extrabold text-hero">PR</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        aria-label={`Remove set ${j + 1}`}
                        disabled={en.sets.length < 2}
                        onClick={() => update((x) => ((x.entries[i].sets = x.entries[i].sets.filter((_, k) => k !== j)), x))}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-ctl text-muted"
                      >
                        <X size={16} aria-hidden />
                      </button>
                    )}
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() =>
                  update((x) => {
                    const sets = x.entries[i].sets;
                    sets.push({ ...(sets[sets.length - 1] ?? { w: '', r: '' }) });
                    return x;
                  })
                }
                className="inline-flex h-9 items-center gap-1.5 self-start rounded-ctl border border-line bg-surface px-3 text-[13px] font-bold"
              >
                <Plus size={14} strokeWidth={2.5} aria-hidden />
                Add set
              </button>
            </div>
          );
        })}

        <ExerciseSelect
          label="Add an exercise"
          exercises={exercises}
          value=""
          placeholder="Add an exercise…"
          onChange={(v) => {
            if (!v) return;
            const last = lastSets(workouts, v, d.date);
            update((x) => {
              x.entries.push({
                key: key(),
                exercise_id: v,
                sets: [{ w: last ? kg(last.sets[0].w) : '', r: last ? String(last.sets[0].r) : '' }]
              });
              return x;
            });
          }}
        />

        <Field label="Note (optional)">
          {(id) => (
            <textarea
              id={id}
              value={d.note}
              maxLength={500}
              onChange={(e) => update((x) => ({ ...x, note: e.target.value }))}
              placeholder="How did it feel?"
              className="min-h-[72px] w-full rounded-btn border border-line2 bg-surface px-4 py-3 text-[16px]"
            />
          )}
        </Field>

        {error && <Notice tone="rose">{error}</Notice>}
        {d.entries.some((en) => en.sets.some((s) => parseWeight(s.w) > (bestBefore[en.exercise_id] ?? Infinity))) && (
          <div className="flex items-center gap-2 text-[13px] font-semibold text-sun-ink">
            <Badge kind="PR" /> This workout sets a new personal record.
          </div>
        )}
        <Button variant="coral" onClick={() => void save()} disabled={busy}>
          {busy ? 'Saving…' : d.id ? 'Save changes' : 'Save workout'}
        </Button>
        {d.id && (
          <Button variant="danger" onClick={() => void remove()} disabled={busy}>
            {confirmDelete ? 'Tap again to delete' : 'Delete workout'}
          </Button>
        )}
      </div>
    </BottomSheet>
  );
}
