import { useEffect, useState } from 'react';
import { loadCofid, searchFoods } from './nutrition/cofid';
import type { FoodResult } from './nutrition/types';
import { Plus } from 'lucide-react';
import { BottomSheet, inputClass } from '@/components/ui';
import { useMealPrep } from './store';
import { vagueMessage } from './vague';
import type { Ingredient } from './types';

// Search box for adding an ingredient to a recipe: your own ingredients first,
// or create a new one. (Food database results arrive with the nutrition lookup.)

export default function IngredientPicker({
  open,
  exclude,
  onClose,
  onPick,
  onCreate,
  onCreateFrom
}: {
  open: boolean;
  exclude: Set<string>;
  onClose: () => void;
  onPick: (i: Ingredient) => void;
  onCreate: (name: string) => void;
  /** New ingredient from a food database result. */
  onCreateFrom: (r: FoodResult) => void;
}) {
  const { ingredients } = useMealPrep();
  const [q, setQ] = useState('');
  const [cofid, setCofid] = useState<FoodResult[] | null>(null);
  useEffect(() => {
    if (!open) return;
    setQ('');
    loadCofid().then(setCofid, () => setCofid([]));
  }, [open]);

  const term = q.trim().toLowerCase();
  const list = ingredients.filter((i) => !exclude.has(i.id) && (!term || i.name.toLowerCase().includes(term)));
  const exact = ingredients.some((i) => i.name.toLowerCase() === term);
  const vague = term ? vagueMessage(q) : null;
  const dbResults = cofid && term.length > 1 ? searchFoods(cofid, term, 8) : [];

  return (
    <BottomSheet open={open} onClose={onClose} title="Add an ingredient">
      <div className="flex flex-col gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your ingredients" aria-label="Search your ingredients" autoComplete="off" className={inputClass} />
        {term && !exact && (
          <button
            type="button"
            disabled={!!vague}
            onClick={() => onCreate(q.trim())}
            className="flex items-center gap-2 rounded-btn border border-dashed border-line2 px-3.5 py-3 text-left font-semibold"
          >
            <Plus size={16} aria-hidden />
            New ingredient “{q.trim()}”
          </button>
        )}
        {vague && <p className="text-[13px] text-sun-ink">{vague}</p>}
        <div className="flex max-h-[45dvh] flex-col gap-2 overflow-y-auto">
          {list.map((i) => (
            <button key={i.id} type="button" onClick={() => onPick(i)} className="flex items-center justify-between gap-2 rounded-btn border border-line bg-bg px-3.5 py-3 text-left">
              <span className="min-w-0">
                <span className="block font-bold">{i.name}</span>
                <span className="text-[13px] text-muted">{i.nutrition ? `${i.nutrition.kcal} kcal per 100 g` : 'No nutrition yet'}</span>
              </span>
              {i.ask && <span className="rounded-[6px] bg-coral-soft px-2 py-0.5 text-[11px] font-extrabold text-coral-ink">Type?</span>}
            </button>
          ))}
          {list.length === 0 && !term && <p className="text-[13px] text-muted">No ingredients yet.</p>}
          {dbResults.length > 0 && <p className="mt-1 text-[12px] font-bold text-muted">From the UK food database (CoFID), per 100 g</p>}
          {dbResults.map((r) => (
            <button key={r.ref} type="button" onClick={() => onCreateFrom(r)} className="flex items-center justify-between gap-2 rounded-btn border border-dashed border-line2 px-3.5 py-3 text-left">
              <span className="min-w-0">
                <span className="block font-semibold leading-snug">{r.name}</span>
                <span className="text-[12px] text-muted">
                  P {r.nutrition.p} · C {r.nutrition.c} · F {r.nutrition.f}
                </span>
              </span>
              <span className="tnum whitespace-nowrap text-[14px] font-bold">{r.nutrition.kcal} kcal</span>
            </button>
          ))}
        </div>
      </div>
    </BottomSheet>
  );
}
