import { useEffect, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { BottomSheet, Button, Notice } from '@/components/ui';
import { fromISODate } from '@/lib/date';
import { oneDp, parseDecimal } from '@/lib/number';
import { useFuelLog } from '@/modules/fuellog/store';
import type { MealFood } from './mealFoods';
import type { MealType } from './types';

// "I ate this": logs a planned meal to the signed-in person's own Fuel Log,
// as a snapshot of the recipe's per-portion numbers right now.

export type EatTarget = { date: string; slot: MealType; meal: MealFood };

export default function EatSheet({ target, onClose }: { target: EatTarget | null; onClose: () => void }) {
  const { saveEntry } = useFuelLog();
  const [servings, setServings] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (target) {
      setServings('1');
      setError(null);
    }
  }, [target]);

  const sv = parseDecimal(servings);
  const step = (d: number) =>
    setServings((cur) => {
      const n = parseDecimal(cur);
      return oneDp(Math.max(0.5, (Number.isFinite(n) ? n : 1) + d));
    });

  async function save() {
    if (!target) return;
    if (!(sv > 0 && sv <= 20)) return setError('Servings must be a number above 0.');
    setBusy(true);
    try {
      const m = target.meal;
      await saveEntry({
        date: target.date,
        meal: target.slot,
        food_id: m.id,
        meal_id: m.id,
        servings: Math.round(sv * 100) / 100,
        name: m.name,
        kcal: m.kcal,
        p: m.p,
        c: m.c,
        f: m.f
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log it.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet open={!!target} onClose={onClose} title="I ate this">
      {target && (
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-[17px] font-extrabold">{target.meal.name}</p>
            <p className="text-[13px] text-muted">
              {target.slot[0].toUpperCase() + target.slot.slice(1)} ·{' '}
              {fromISODate(target.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })} · logs to your Fuel Log only
            </p>
          </div>
          <div>
            <p className="mb-1.5 text-[13px] font-semibold text-muted">Servings</p>
            <div className="flex items-center gap-2">
              <button type="button" aria-label="Fewer servings" onClick={() => step(-0.5)} className="inline-flex h-11 w-11 items-center justify-center rounded-btn bg-chip">
                <Minus size={18} aria-hidden />
              </button>
              <input
                inputMode="decimal"
                aria-label="Servings"
                value={servings}
                onChange={(e) => setServings(e.target.value)}
                className="tnum h-11 w-20 rounded-ctl border border-line2 bg-surface text-center text-[16px]"
              />
              <button type="button" aria-label="More servings" onClick={() => step(0.5)} className="inline-flex h-11 w-11 items-center justify-center rounded-btn bg-chip">
                <Plus size={18} aria-hidden />
              </button>
              {Number.isFinite(sv) && <span className="tnum ml-auto font-extrabold">{Math.round(target.meal.kcal * sv).toLocaleString('en-GB')} kcal</span>}
            </div>
            <p className="mt-2 text-[13px] text-muted">
              Per portion: {target.meal.kcal} kcal · P {oneDp(target.meal.p)} · C {oneDp(target.meal.c)} · F {oneDp(target.meal.f)} g
            </p>
          </div>
          {!target.meal.counted && <Notice tone="sun">This recipe has no counted ingredients yet, so it logs 0 kcal. Add amounts in Meal Prep.</Notice>}
          {error && <Notice tone="rose">{error}</Notice>}
          <Button variant="green" onClick={() => void save()} disabled={busy}>
            {busy ? 'Logging…' : 'Log to my Fuel Log'}
          </Button>
        </div>
      )}
    </BottomSheet>
  );
}
