import { useEffect, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { BottomSheet, Button, Notice, inputClass } from '@/components/ui';
import { oneDp, parseDecimal } from '@/lib/number';
import { useFuelLog } from './store';
import { MEALS, type Entry, type Meal } from './types';

// Log a food from My foods into a meal, or change/remove a logged entry.

export type FoodDraft = { date: string; meal: Meal; entry?: Entry };

const num = (n: number) => Math.round(n).toLocaleString('en-GB');
const macroLine = (p: number | null, c: number | null, f: number | null) =>
  p === null && c === null && f === null ? 'Calories only' : `P ${oneDp(p ?? 0)} · C ${oneDp(c ?? 0)} · F ${oneDp(f ?? 0)} g`;

export default function FoodSheet({
  draft,
  onClose,
  onManageFoods
}: {
  draft: FoodDraft | null;
  onClose: () => void;
  onManageFoods: () => void;
}) {
  const { foods, saveEntry, deleteEntry } = useFuelLog();
  const [meal, setMeal] = useState<Meal>('breakfast');
  const [q, setQ] = useState('');
  const [foodId, setFoodId] = useState<string | null>(null);
  const [servings, setServings] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!draft) return;
    setMeal(draft.entry?.meal ?? draft.meal);
    setFoodId(draft.entry?.food_id ?? null);
    setServings(draft.entry ? oneDp(draft.entry.servings) : '1');
    setQ('');
    setError(null);
  }, [draft]);

  const editing = draft?.entry;
  const food = foods.find((f) => f.id === foodId);
  const sv = parseDecimal(servings);
  const perServing = editing && !food ? editing : food;
  const list = foods.filter((f) => !q.trim() || f.name.toLowerCase().includes(q.trim().toLowerCase()));

  const step = (d: number) =>
    setServings((cur) => {
      const n = parseDecimal(cur);
      return oneDp(Math.max(0.5, (Number.isFinite(n) ? n : 1) + d));
    });

  async function save() {
    if (!draft) return;
    if (!Number.isFinite(sv) || sv <= 0 || sv > 50) return setError('Servings must be a number above 0.');
    // Editing keeps the values copied when it was logged, unless a different food is picked.
    const src = editing && foodId === editing.food_id ? editing : food;
    if (!src) return setError('Pick a food.');
    setBusy(true);
    try {
      await saveEntry(
        {
          date: draft.date,
          meal,
          food_id: foodId!,
          servings: Math.round(sv * 100) / 100,
          name: src.name,
          kcal: src.kcal,
          p: src.p,
          c: src.c,
          f: src.f
        },
        editing?.id
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!editing) return;
    setBusy(true);
    try {
      await deleteEntry(editing.id);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet open={!!draft} onClose={onClose} title={editing ? `Edit ${editing.name}` : 'Log food'}>
      <div className="flex flex-col gap-4">
        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-muted">Meal</p>
          <div className="flex flex-wrap gap-2">
            {MEALS.map((m) => (
              <button
                key={m.id}
                type="button"
                aria-pressed={meal === m.id}
                onClick={() => setMeal(m.id)}
                className={`h-9 rounded-ctl border px-3.5 text-[14px] font-semibold ${
                  meal === m.id ? 'border-btn bg-btn text-btn-text' : 'border-line2 bg-surface'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {!editing && (
          <>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search my foods"
              aria-label="Search my foods"
              autoComplete="off"
              className={inputClass}
            />
            <div className="flex max-h-[38dvh] flex-col gap-2 overflow-y-auto">
              {list.length === 0 && <p className="text-[13px] text-muted">No foods match. Add it to My foods first.</p>}
              {list.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={foodId === f.id}
                  onClick={() => setFoodId(f.id)}
                  className={`flex w-full items-center justify-between gap-2.5 rounded-btn border px-3.5 py-3 text-left ${
                    foodId === f.id ? 'border-green bg-green-soft' : 'border-line bg-bg'
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block font-bold">{f.name}</span>
                    <span className="text-[13px] text-muted">{macroLine(f.p, f.c, f.f)}</span>
                  </span>
                  <span className="tnum whitespace-nowrap font-bold">{num(f.kcal)} kcal</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={onManageFoods}
              className="inline-flex h-[38px] items-center gap-1.5 self-start rounded-ctl border border-line bg-surface px-3.5 text-[13px] font-bold"
            >
              <Plus size={14} strokeWidth={2.5} aria-hidden />
              Add a new food
            </button>
          </>
        )}

        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-muted">Servings</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Fewer servings"
              onClick={() => step(-0.5)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-btn bg-chip"
            >
              <Minus size={18} aria-hidden />
            </button>
            <input
              inputMode="decimal"
              aria-label="Servings"
              value={servings}
              onChange={(e) => setServings(e.target.value)}
              className="tnum h-11 w-20 rounded-ctl border border-line2 bg-surface text-center text-[16px]"
            />
            <button
              type="button"
              aria-label="More servings"
              onClick={() => step(0.5)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-btn bg-chip"
            >
              <Plus size={18} aria-hidden />
            </button>
            {perServing && Number.isFinite(sv) && (
              <span className="tnum ml-auto font-extrabold">{num(perServing.kcal * sv)} kcal</span>
            )}
          </div>
        </div>

        {error && <Notice tone="rose">{error}</Notice>}
        <Button variant="green" onClick={() => void save()} disabled={busy || (!food && !editing)}>
          {editing ? 'Save changes' : `Add to ${MEALS.find((m) => m.id === meal)!.label.toLowerCase()}`}
        </Button>
        {editing && (
          <Button variant="danger" onClick={() => void remove()} disabled={busy}>
            Remove from {MEALS.find((m) => m.id === editing.meal)!.label.toLowerCase()}
          </Button>
        )}
      </div>
    </BottomSheet>
  );
}
