import { useState, type FormEvent } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { BottomSheet, Button, Field, Notice, inputClass } from '@/components/ui';
import { oneDp, parseDecimal } from '@/lib/number';
import { useFuelLog } from './store';
import type { Food } from './types';

// My foods: add, edit and delete foods. Logged entries keep their own copy of
// the values, so editing a food here doesn't change past days.

type Form = { id?: string; name: string; kcal: string; p: string; c: string; f: string };
const blank: Form = { name: '', kcal: '', p: '', c: '', f: '' };
const str = (n: number | null) => (n === null ? '' : oneDp(n));

export default function FoodsSheet({ open, onClose, onBack }: { open: boolean; onClose: () => void; onBack?: () => void }) {
  const { foods, saveFood, deleteFood } = useFuelLog();
  const [form, setForm] = useState<Form>(blank);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  const edit = (f: Food) => {
    setForm({ id: f.id, name: f.name, kcal: str(f.kcal), p: str(f.p), c: str(f.c), f: str(f.f) });
    setError(null);
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    const name = form.name.trim();
    const kcal = parseDecimal(form.kcal);
    if (!name) return setError('Give the food a name.');
    if (!Number.isFinite(kcal) || kcal < 0 || kcal > 5000) return setError('Enter the calories per serving.');
    const macro = (s: string) => {
      const n = parseDecimal(s);
      return Number.isFinite(n) && n >= 0 ? Math.round(n * 10) / 10 : null;
    };
    for (const s of [form.p, form.c, form.f]) {
      if (s.trim() && macro(s) === null) return setError('Protein, carbs and fat must be numbers (or left blank).');
    }
    if (!form.id && foods.some((f) => f.name.toLowerCase() === name.toLowerCase())) return setError('You already have that food.');
    try {
      await saveFood({ name, kcal: Math.round(kcal), p: macro(form.p), c: macro(form.c), f: macro(form.f) }, form.id);
      setForm(blank);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the food.');
    }
  }

  const set = (k: keyof Form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  return (
    <BottomSheet open={open} onClose={onClose} title="My foods">
      <div className="flex flex-col gap-4">
        <form onSubmit={submit} className="flex flex-col gap-3 rounded-card border border-line bg-bg p-4">
          <p className="font-extrabold">{form.id ? 'Edit food' : 'Add a food'}</p>
          <Field label="Name">
            {(id) => <input id={id} value={form.name} onChange={set('name')} maxLength={80} placeholder="e.g. Chicken wrap" autoComplete="off" className={inputClass} />}
          </Field>
          <Field label="Calories per serving">
            {(id) => <input id={id} value={form.kcal} onChange={set('kcal')} inputMode="numeric" className={`${inputClass} tnum`} />}
          </Field>
          <div className="grid grid-cols-3 gap-2">
            {(['p', 'c', 'f'] as const).map((k) => (
              <Field key={k} label={{ p: 'Protein g', c: 'Carbs g', f: 'Fat g' }[k]}>
                {(id) => <input id={id} value={form[k]} onChange={set(k)} inputMode="decimal" className={`${inputClass} tnum px-2 text-center`} />}
              </Field>
            ))}
          </div>
          {error && <Notice tone="rose">{error}</Notice>}
          <div className="flex gap-2">
            <Button type="submit" variant="green">
              {form.id ? 'Save food' : 'Add food'}
            </Button>
            {form.id && (
              <Button variant="ghost" full={false} onClick={() => setForm(blank)}>
                Cancel
              </Button>
            )}
          </div>
        </form>

        <ul className="flex flex-col gap-2">
          {foods.map((f) => (
            <li key={f.id} className="flex items-center gap-1 rounded-btn border border-line bg-bg py-1.5 pl-3.5 pr-1">
              <span className="min-w-0 flex-1">
                <span className="block font-bold">{f.name}</span>
                <span className="tnum text-[13px] text-muted">
                  {Math.round(f.kcal)} kcal · P {str(f.p) || '–'} · C {str(f.c) || '–'} · F {str(f.f) || '–'}
                </span>
              </span>
              <button type="button" aria-label={`Edit ${f.name}`} onClick={() => edit(f)} className="inline-flex h-10 w-10 items-center justify-center rounded-ctl text-muted">
                <Pencil size={16} aria-hidden />
              </button>
              <button
                type="button"
                aria-label={confirm === f.id ? `Tap again to delete ${f.name}` : `Delete ${f.name}`}
                onClick={() => (confirm === f.id ? void deleteFood(f.id).then(() => setConfirm(null)) : setConfirm(f.id))}
                className={`inline-flex h-10 items-center justify-center rounded-ctl px-2.5 ${confirm === f.id ? 'bg-rose-soft text-[12px] font-bold text-rose-ink' : 'w-10 text-muted'}`}
              >
                {confirm === f.id ? 'Delete?' : <Trash2 size={16} aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
        {onBack && (
          <Button variant="ghost" onClick={onBack}>
            Back to logging food
          </Button>
        )}
      </div>
    </BottomSheet>
  );
}
