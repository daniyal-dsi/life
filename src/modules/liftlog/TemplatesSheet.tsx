import { useState } from 'react';
import { ArrowDown, ArrowUp, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import { BottomSheet, Button, Field, Notice, inputClass } from '@/components/ui';
import ExerciseSelect from './ExerciseSelect';
import { plural } from './format';
import { useLiftLog } from './store';
import type { Template, TemplateItem } from './types';

// Create, edit, delete and start workout templates (e.g. Push, Pull, Legs).

type Editing = { id?: string; name: string; items: { sets: string; reps: string; exercise_id: string }[] };

export default function TemplatesSheet({
  open,
  onClose,
  onStart
}: {
  open: boolean;
  onClose: () => void;
  onStart: (t: Template) => void;
}) {
  const { templates, exercises, saveTemplate, deleteTemplate } = useLiftLog();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const nameOf = (id: string) => exercises.find((e) => e.id === id)?.name ?? 'Removed exercise';

  function close() {
    setEditing(null);
    setError(null);
    onClose();
  }

  function edit(t?: Template) {
    setError(null);
    setConfirmDelete(false);
    setEditing(
      t
        ? { id: t.id, name: t.name, items: t.items.map((i) => ({ exercise_id: i.exercise_id, sets: String(i.sets), reps: String(i.reps) })) }
        : { name: '', items: [] }
    );
  }

  async function save() {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) return setError('Give the template a name.');
    const items: TemplateItem[] = [];
    for (const i of editing.items) {
      const sets = Number(i.sets);
      const reps = Number(i.reps);
      if (!Number.isInteger(sets) || sets < 1 || sets > 20) return setError('Sets must be a whole number from 1 to 20.');
      if (!Number.isInteger(reps) || reps < 1 || reps > 100) return setError('Reps must be a whole number from 1 to 100.');
      items.push({ exercise_id: i.exercise_id, sets, reps });
    }
    if (!items.length) return setError('Add at least one exercise.');
    try {
      await saveTemplate({ name, items }, editing.id);
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the template.');
    }
  }

  async function remove() {
    if (!editing?.id) return;
    if (!confirmDelete) return setConfirmDelete(true);
    await deleteTemplate(editing.id);
    setEditing(null);
  }

  const setItems = (fn: (items: Editing['items']) => Editing['items']) =>
    setEditing((e) => (e ? { ...e, items: fn([...e.items]) } : e));

  return (
    <BottomSheet open={open} onClose={close} title={editing ? (editing.id ? 'Edit template' : 'New template') : 'Templates'}>
      {!editing ? (
        <div className="flex flex-col gap-3">
          {templates.length === 0 && <p className="text-[14px] text-muted">No templates yet.</p>}
          {templates.map((t) => (
            <div key={t.id} className="flex items-center gap-2 rounded-card border border-line bg-surface p-3">
              <div className="min-w-0 flex-1">
                <p className="font-extrabold">{t.name}</p>
                <p className="truncate text-[13px] text-muted">
                  {plural(t.items.length, 'exercise')} · {t.items.map((i) => nameOf(i.exercise_id)).join(', ')}
                </p>
              </div>
              <button
                type="button"
                aria-label={`Edit ${t.name}`}
                onClick={() => edit(t)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-btn border border-line"
              >
                <Pencil size={16} aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => {
                  close();
                  onStart(t);
                }}
                className="inline-flex h-10 items-center gap-1.5 rounded-btn bg-coral px-3 text-[14px] font-bold text-hero"
              >
                <Play size={14} fill="currentColor" aria-hidden />
                Start
              </button>
            </div>
          ))}
          <Button variant="secondary" icon={Plus} onClick={() => edit()}>
            New template
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Field label="Name">
            {(id) => (
              <input
                id={id}
                value={editing.name}
                maxLength={40}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="e.g. Upper body"
                className={inputClass}
              />
            )}
          </Field>
          {editing.items.map((item, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-[14px] border border-line bg-bg p-3">
              <div className="flex items-center gap-1">
                <ExerciseSelect
                  label={`Exercise ${i + 1}`}
                  exercises={exercises}
                  value={item.exercise_id}
                  onChange={(v) => setItems((items) => ((items[i] = { ...items[i], exercise_id: v }), items))}
                />
                <button
                  type="button"
                  aria-label="Move up"
                  disabled={i === 0}
                  onClick={() => setItems((items) => ([items[i - 1], items[i]] = [items[i], items[i - 1]], items))}
                  className="inline-flex h-10 w-9 shrink-0 items-center justify-center text-muted"
                >
                  <ArrowUp size={16} aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  disabled={i === editing.items.length - 1}
                  onClick={() => setItems((items) => ([items[i + 1], items[i]] = [items[i], items[i + 1]], items))}
                  className="inline-flex h-10 w-9 shrink-0 items-center justify-center text-muted"
                >
                  <ArrowDown size={16} aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label="Remove exercise"
                  onClick={() => setItems((items) => items.filter((_, j) => j !== i))}
                  className="inline-flex h-10 w-9 shrink-0 items-center justify-center text-muted"
                >
                  <Trash2 size={16} aria-hidden />
                </button>
              </div>
              <div className="flex items-center gap-2 text-[14px]">
                <input
                  inputMode="numeric"
                  aria-label="Target sets"
                  value={item.sets}
                  onChange={(e) => setItems((items) => ((items[i] = { ...items[i], sets: e.target.value }), items))}
                  className="tnum h-11 w-16 rounded-ctl border border-line2 bg-surface text-center text-[16px]"
                />
                <span className="text-muted">sets of</span>
                <input
                  inputMode="numeric"
                  aria-label="Target reps"
                  value={item.reps}
                  onChange={(e) => setItems((items) => ((items[i] = { ...items[i], reps: e.target.value }), items))}
                  className="tnum h-11 w-16 rounded-ctl border border-line2 bg-surface text-center text-[16px]"
                />
                <span className="text-muted">reps</span>
              </div>
            </div>
          ))}
          <ExerciseSelect
            label="Add an exercise"
            exercises={exercises}
            value=""
            placeholder="Add an exercise…"
            onChange={(v) => v && setItems((items) => [...items, { exercise_id: v, sets: '3', reps: '10' }])}
          />
          {error && <Notice tone="rose">{error}</Notice>}
          <Button variant="coral" onClick={() => void save()}>
            Save template
          </Button>
          {editing.id && (
            <Button variant="danger" onClick={() => void remove()}>
              {confirmDelete ? 'Tap again to delete' : 'Delete template'}
            </Button>
          )}
          <Button variant="ghost" onClick={() => setEditing(null)}>
            Back to templates
          </Button>
        </div>
      )}
    </BottomSheet>
  );
}
