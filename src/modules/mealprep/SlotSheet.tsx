import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { BottomSheet, Button, Notice } from '@/components/ui';
import { fromISODate } from '@/lib/date';
import { siteName } from './macros';
import { useEaters } from './people';
import { weekDates } from './plan';
import { useMealPrep } from './store';
import { MEAL_TYPES, type MealType } from './types';

// Plan one slot: pick a meal, who's eating, and (for batch cooking) which
// other days get the same meal in this slot.

export type SlotRef = { date: string; slot: MealType; monday: string };

const dayShort = (iso: string) => fromISODate(iso).toLocaleDateString('en-GB', { weekday: 'short' });

export default function SlotSheet({ slot, onClose }: { slot: SlotRef | null; onClose: () => void }) {
  const { meals, plan, setSlot, clearSlot } = useMealPrep();
  const eaters = useEaters();
  const [mealId, setMealId] = useState('');
  const [who, setWho] = useState<string[]>([]);
  const [also, setAlso] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const current = slot ? plan.find((p) => p.date === slot.date && p.slot === slot.slot) : undefined;

  useEffect(() => {
    if (!slot) return;
    setMealId(current?.meal_id ?? '');
    setWho(current?.eaters ?? eaters.map((e) => e.id));
    setAlso([]);
    setError(null);
  }, [slot?.date, slot?.slot]);

  if (!slot) return <BottomSheet open={false} onClose={onClose} title="">{null}</BottomSheet>;
  const label = MEAL_TYPES.find((t) => t.id === slot.slot)!.label;
  const ordered = [...meals.filter((m) => m.type === slot.slot), ...meals.filter((m) => m.type !== slot.slot)];
  const chosen = meals.find((m) => m.id === mealId);
  const otherDays = weekDates(slot.monday).filter((d) => d !== slot.date);
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  async function save() {
    if (!mealId) return setError('Pick a meal.');
    if (!who.length) return setError('Pick who is eating it.');
    setBusy(true);
    try {
      for (const d of [slot!.date, ...also]) await setSlot(d, slot!.slot, mealId, who);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={`${label} · ${fromISODate(slot.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}`}
    >
      <div className="flex flex-col gap-4">
        <div className="flex max-h-[34dvh] flex-col gap-2 overflow-y-auto">
          {ordered.map((m, i) => (
            <div key={m.id}>
              {i > 0 && m.type !== slot.slot && ordered[i - 1].type === slot.slot && <p className="mb-2 mt-1 text-[12px] font-bold text-muted">Other meals</p>}
              <button
                type="button"
                aria-pressed={mealId === m.id}
                onClick={() => setMealId(m.id)}
                className={`w-full rounded-btn border px-3.5 py-3 text-left font-semibold ${mealId === m.id ? 'border-sun bg-sun-soft' : 'border-line bg-bg'}`}
              >
                {m.name}
              </button>
            </div>
          ))}
          {meals.length === 0 && <p className="text-[13px] text-muted">Add meals under Meals first.</p>}
        </div>

        {chosen?.link && (
          <a href={chosen.link} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center justify-center gap-2 rounded-btn bg-chip font-semibold">
            <ExternalLink size={17} aria-hidden />
            Open recipe · {siteName(chosen.link)}
          </a>
        )}

        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-muted">Who's eating</p>
          <div className="flex flex-wrap gap-2">
            {eaters.map((e) => (
              <button
                key={e.id}
                type="button"
                aria-pressed={who.includes(e.id)}
                onClick={() => setWho((w) => toggle(w, e.id))}
                className={`h-9 rounded-ctl border px-3.5 text-[14px] font-semibold ${who.includes(e.id) ? 'border-btn bg-btn text-btn-text' : 'border-line2 bg-surface'}`}
              >
                {e.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-muted">Batch cook: same {slot.slot} on</p>
          <div className="grid grid-cols-6 gap-1.5">
            {otherDays.map((d) => {
              const taken = plan.find((p) => p.date === d && p.slot === slot.slot);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={also.includes(d)}
                  title={taken ? `Replaces ${meals.find((m) => m.id === taken.meal_id)?.name ?? 'a meal'}` : undefined}
                  onClick={() => setAlso((a) => toggle(a, d))}
                  className={`h-10 rounded-ctl border text-[13px] font-semibold ${also.includes(d) ? 'border-sun bg-sun-soft text-sun-ink' : 'border-line2 bg-surface'} ${taken && !also.includes(d) ? 'text-muted' : ''}`}
                >
                  {dayShort(d)}
                </button>
              );
            })}
          </div>
        </div>

        {error && <Notice tone="rose">{error}</Notice>}
        <Button variant="sun" onClick={() => void save()} disabled={busy}>
          {also.length ? `Plan for ${also.length + 1} days` : current ? 'Save' : 'Add to plan'}
        </Button>
        {current && (
          <Button
            variant="danger"
            onClick={async () => {
              await clearSlot(slot.date, slot.slot);
              onClose();
            }}
          >
            Remove from plan
          </Button>
        )}
      </div>
    </BottomSheet>
  );
}
