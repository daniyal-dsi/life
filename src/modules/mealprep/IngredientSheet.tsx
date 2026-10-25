import { useEffect, useState } from 'react';
import { BottomSheet, Button, Field, Notice, Switch, inputClass } from '@/components/ui';
import { oneDp, parseDecimal } from '@/lib/number';
import { useMealPrep } from './store';
import { AISLES, SIZED_UNITS, SOURCES, type Aisle, type Ingredient, type IngredientData, type Source, type Unit } from './types';
import NutritionFinder from './nutrition/NutritionFinder';
import { friendlyName, guessAisle, guessCooked, type FoodResult } from './nutrition/types';
import { suggestionsFor, vagueMessage } from './vague';

// Add or edit an ingredient. Vague names are blocked; an imported "Type?"
// ingredient offers specific names to pick from.

type Form = {
  name: string;
  aisle: Aisle;
  staple: boolean;
  cooked: string;
  grams: Partial<Record<Unit, string>>;
  kcal: string;
  p: string;
  c: string;
  f: string;
  source: Source;
  sourceName: string;
};

const empty = (name = ''): Form => ({ name, aisle: 'veg', staple: false, cooked: '100', grams: {}, kcal: '', p: '', c: '', f: '', source: 'Manual', sourceName: '' });

function toForm(i: Ingredient): Form {
  const s = (n: number | undefined) => (n === undefined ? '' : oneDp(n));
  return {
    name: i.name,
    aisle: i.aisle,
    staple: i.staple,
    cooked: s(i.cooked_per_100g_raw),
    grams: Object.fromEntries(Object.entries(i.grams_per).map(([u, g]) => [u, s(g)])),
    kcal: s(i.nutrition?.kcal),
    p: s(i.nutrition?.p),
    c: s(i.nutrition?.c),
    f: s(i.nutrition?.f),
    source: i.source ?? 'Manual',
    sourceName: i.source_name ?? ''
  };
}

/** Form values from a database result (for a new ingredient, also name, aisle and cooked weight). */
function fromResult(r: FoodResult, base: Form, isNew: boolean): Form {
  const aisle = guessAisle(r);
  return {
    ...base,
    ...(isNew ? { name: friendlyName(r.name), aisle, staple: aisle === 'spice', cooked: String(guessCooked(r, aisle)) } : {}),
    kcal: String(r.nutrition.kcal),
    p: String(r.nutrition.p),
    c: String(r.nutrition.c),
    f: String(r.nutrition.f),
    source: r.source,
    sourceName: r.detail ? `${r.name} (${r.detail})` : r.name
  };
}

export default function IngredientSheet({
  ingredient,
  newName,
  fromDatabase,
  open,
  onClose,
  onSaved
}: {
  ingredient?: Ingredient | null;
  /** Prefills the name when creating from a search. */
  newName?: string;
  /** Prefills a new ingredient from a food database result. */
  fromDatabase?: FoodResult | null;
  open: boolean;
  onClose: () => void;
  onSaved?: (id: string) => void;
}) {
  const { ingredients, saveIngredient, deleteIngredient } = useMealPrep();
  const [f, setF] = useState<Form>(empty());
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  /** 'nutrition' fills the numbers; 'type' also sets a specific name (for "Type?"). */
  const [finder, setFinder] = useState<'nutrition' | 'type' | null>(null);

  useEffect(() => {
    if (!open) return;
    const base = ingredient ? toForm(ingredient) : empty(newName ?? '');
    setF(fromDatabase && !ingredient ? fromResult(fromDatabase, base, true) : base);
    setError(null);
    setConfirm(false);
  }, [open, ingredient, newName, fromDatabase]);

  const vague = vagueMessage(f.name);
  const picks = ingredient?.ask ? suggestionsFor(ingredient.name) : [];
  const set = (k: keyof Form) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function save() {
    const name = f.name.trim();
    if (!name) return setError('Give the ingredient a name.');
    if (vague) return setError(vague);
    if (ingredients.some((i) => i.id !== ingredient?.id && i.name.toLowerCase() === name.toLowerCase())) return setError('You already have that ingredient.');
    const cooked = parseDecimal(f.cooked);
    if (!(cooked > 0 && cooked <= 400)) return setError('Cooked weight from 100 g raw should be between 1 and 400 g.');
    const grams: Partial<Record<Unit, number>> = {};
    for (const [u, s] of Object.entries(f.grams)) {
      if (!s?.trim()) continue;
      const g = parseDecimal(s);
      if (!(g > 0)) return setError(`Grams per ${u} must be a number above 0.`);
      grams[u as Unit] = Math.round(g * 10) / 10;
    }
    const nums = [f.kcal, f.p, f.c, f.f].map(parseDecimal);
    const anyNut = [f.kcal, f.p, f.c, f.f].some((s) => s.trim());
    if (anyNut && nums.some((n) => !(n >= 0))) return setError('Enter calories, protein, carbs and fat per 100 g, or leave them all blank.');
    const renamed = ingredient && name.toLowerCase() !== ingredient.name.toLowerCase();
    const data: IngredientData = {
      name,
      aisle: f.aisle,
      staple: f.staple,
      cooked_per_100g_raw: Math.round(cooked * 10) / 10,
      grams_per: grams,
      nutrition: anyNut ? { kcal: Math.round(nums[0]), p: oneDpN(nums[1]), c: oneDpN(nums[2]), f: oneDpN(nums[3]) } : null,
      source: anyNut ? f.source : null,
      source_name: anyNut ? f.sourceName.trim() || null : null,
      // Changing the numbers or renaming means they're no longer the imported starter values.
      ...(ingredient?.starter && !renamed && sameNutrition(ingredient, nums) ? { starter: true } : {}),
      // Picking a specific name answers the "Type?" question.
      ask: ingredient?.ask && !renamed ? ingredient.ask : null
    };
    try {
      const id = await saveIngredient(data, ingredient?.id);
      onSaved?.(id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    }
  }

  async function remove() {
    if (!ingredient) return;
    if (!confirm) return setConfirm(true);
    try {
      await deleteIngredient(ingredient.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete.');
      setConfirm(false);
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={ingredient ? 'Ingredient' : 'New ingredient'}>
      <div className="flex flex-col gap-4">
        {ingredient?.ask && (
          <Notice tone="sun">
            <b>Type?</b> {ingredient.ask}
            {picks.length > 0 && (
              <span className="mt-2 flex flex-wrap gap-2">
                {picks.map((p) => (
                  <button key={p} type="button" onClick={() => setF({ ...f, name: p })} className="h-8 rounded-chip bg-surface px-3 text-[13px] font-bold text-ink">
                    {p}
                  </button>
                ))}
              </span>
            )}
            <button type="button" onClick={() => setFinder('type')} className="mt-2 block font-bold underline">
              Pick from the food database
            </button>
          </Notice>
        )}
        <Field label="Name" hint={vague ?? undefined}>
          {(id) => <input id={id} value={f.name} maxLength={80} onChange={set('name')} placeholder="e.g. Chicken thigh" autoComplete="off" className={inputClass} />}
        </Field>
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Aisle">
            {(id) => (
              <select id={id} value={f.aisle} onChange={(e) => setF({ ...f, aisle: e.target.value as Aisle })} className={inputClass}>
                {AISLES.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Cooked g from 100 g raw" hint="e.g. chicken breast 75">
            {(id) => <input id={id} inputMode="decimal" value={f.cooked} onChange={set('cooked')} className={`${inputClass} tnum`} />}
          </Field>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>
            <span className="block font-semibold">Staple</span>
            <span className="text-[13px] text-muted">Usually in stock; listed separately when shopping</span>
          </span>
          <Switch checked={f.staple} onChange={(staple) => setF({ ...f, staple })} label="Staple" />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-[13px] font-semibold text-muted">Nutrition per 100 g cooked</p>
            <button type="button" onClick={() => setFinder('nutrition')} className="h-8 rounded-ctl border border-line bg-surface px-3 text-[13px] font-bold">
              Find nutrition
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {(['kcal', 'p', 'c', 'f'] as const).map((k) => (
              <Field key={k} label={{ kcal: 'kcal', p: 'Protein', c: 'Carbs', f: 'Fat' }[k]}>
                {(id) => <input id={id} inputMode="decimal" value={f[k]} onChange={set(k)} className={`${inputClass} tnum px-1.5 text-center`} />}
              </Field>
            ))}
          </div>
          <div className="mt-2.5 grid grid-cols-[120px_1fr] gap-2">
            <select aria-label="Source" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value as Source })} className={inputClass}>
              {SOURCES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <input aria-label="Source entry" value={f.sourceName} onChange={set('sourceName')} placeholder="Database entry or pack" className={inputClass} />
          </div>
          {ingredient?.source_name && f.name.trim().toLowerCase() !== ingredient.name.toLowerCase() ? (
            <Notice tone="sun">These numbers are for “{ingredient.source_name}”. Update them for {f.name.trim() || 'the new name'}.</Notice>
          ) : (
            ingredient?.starter && <p className="mt-1.5 text-[12px] text-muted">Starter values imported with your meals; check them against the database or pack.</p>
          )}
        </div>

        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-muted">Grams per unit (where a recipe uses it)</p>
          <div className="grid grid-cols-4 gap-2">
            {SIZED_UNITS.map((u) => (
              <Field key={u} label={u}>
                {(id) => (
                  <input
                    id={id}
                    inputMode="decimal"
                    value={f.grams[u] ?? ''}
                    placeholder={{ cup: '240', tbsp: '15', tsp: '5' }[u as string] ?? ''}
                    onChange={(e) => setF({ ...f, grams: { ...f.grams, [u]: e.target.value } })}
                    className={`${inputClass} tnum px-1.5 text-center`}
                  />
                )}
              </Field>
            ))}
          </div>
          <p className="mt-1.5 text-[12px] text-muted">Blank cup, tbsp and tsp use 240, 15 and 5 g. ml counts as grams.</p>
        </div>

        {error && <Notice tone="rose">{error}</Notice>}
        <Button variant="sun" onClick={() => void save()}>
          {ingredient ? 'Save ingredient' : 'Add ingredient'}
        </Button>
        <NutritionFinder
          open={finder !== null}
          initialQuery={f.name}
          onClose={() => setFinder(null)}
          onPick={(r) => {
            const next = fromResult(r, f, false);
            setF(finder === 'type' ? { ...next, name: friendlyName(r.name) } : next);
            setFinder(null);
          }}
        />
        {ingredient && (
          <Button variant="danger" onClick={() => void remove()}>
            {confirm ? 'Tap again to delete' : 'Delete ingredient'}
          </Button>
        )}
      </div>
    </BottomSheet>
  );
}

const oneDpN = (n: number) => Math.round(n * 10) / 10;
function sameNutrition(i: Ingredient, nums: number[]): boolean {
  const n = i.nutrition;
  return !!n && Math.round(nums[0]) === n.kcal && oneDpN(nums[1]) === n.p && oneDpN(nums[2]) === n.c && oneDpN(nums[3]) === n.f;
}
