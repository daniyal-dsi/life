import { useEffect, useState } from 'react';
import { ExternalLink, Plus, X } from 'lucide-react';
import { BackLink } from '@/modules/workflow/parts';
import { Button, Card, Field, Notice, Segmented, SectionTitle, inputClass } from '@/components/ui';
import { oneDp, parseDecimal } from '@/lib/number';
import IngredientPicker from './IngredientPicker';
import { dataOf } from '@/lib/useVersioned';
import { UNIT_DEFAULTS } from './guess';
import IngredientSheet from './IngredientSheet';
import type { FoodResult } from '@/lib/nutrition/types';
import { mealMacros, normaliseLink, siteName } from './macros';
import { useMealPrep } from './store';
import { MEAL_TYPES, UNITS, type Ingredient, type IngredientData, type Meal, type MealType, type Unit } from './types';

// Recipe editor: amounts are COOKED weight per portion. Per-portion calories
// and macros update as you type; anything that can't be counted is listed.

type DraftLine = { key: string; ingredient_id: string; qty: string; unit: Unit; skip_weight?: boolean };

const REASON = {
  'no amount': 'no amount',
  'no unit size': 'unit weight unknown',
  'no nutrition': 'no nutrition yet',
  missing: 'removed'
};

export default function MealEditor({ meal, onDone }: { meal: Meal | null; onDone: () => void }) {
  const { ingredients, saveMeal, deleteMeal, saveIngredient } = useMealPrep();
  const [name, setName] = useState('');
  const [type, setType] = useState<MealType>('dinner');
  const [link, setLink] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [picker, setPicker] = useState(false);
  const [editIng, setEditIng] = useState<Ingredient | null>(null);
  const [newIng, setNewIng] = useState<string | null>(null);
  const [fromDb, setFromDb] = useState<FoodResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    setName(meal?.name ?? '');
    setType(meal?.type ?? 'dinner');
    setLink(meal?.link ?? '');
    setLines((meal?.lines ?? []).map((l) => ({ ...l, qty: l.qty === null ? '' : oneDp(l.qty) })));
  }, [meal?.id]);

  const parsed = lines.map((l) => ({ ...l, qty: l.qty.trim() === '' ? null : parseDecimal(l.qty) }));
  const M = mealMacros(parsed, ingredients);
  const linkNorm = normaliseLink(link);
  const ingOf = (id: string) => ingredients.find((i) => i.id === id);

  const add = (i: Ingredient) => {
    const unit: Unit = (['tin', 'whole', 'clove', 'bunch'] as Unit[]).find((u) => i.grams_per[u]) ?? 'g';
    setLines((ls) => [...ls, { key: crypto.randomUUID(), ingredient_id: i.id, qty: '', unit }]);
    setPicker(false);
  };

  async function save() {
    const n = name.trim();
    if (!n) return setError('Give the meal a name.');
    if (linkNorm === null) return setError("That recipe link isn't a web address.");
    if (parsed.some((l) => l.qty !== null && !(l.qty > 0))) return setError('Amounts must be numbers above 0 (or left blank).');
    try {
      await saveMeal(
        { name: n, type, link: linkNorm || null, lines: parsed.map((l) => ({
            key: l.key,
            ingredient_id: l.ingredient_id,
            qty: l.qty === null ? null : Math.round(l.qty * 100) / 100,
            unit: l.unit,
            ...(l.skip_weight ? { skip_weight: true } : {})
          }))
        },
        meal?.id
      );
      setError(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      if (!meal) onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    }
  }

  async function remove() {
    if (!meal) return;
    if (!confirm) return setConfirm(true);
    await deleteMeal(meal.id);
    onDone();
  }

  const r = (x: number) => Math.round(x);
  return (
    <>
      <BackLink to="/health?m=meal&v=meals" label="Meals" />
      <Field label="Meal name">
        {(id) => <input id={id} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chicken Pasta" className={inputClass} />}
      </Field>
      <Segmented label="Meal type" options={MEAL_TYPES} value={type} onChange={setType} />

      <Card dark className="!p-5">
        <p className="text-[13px] text-hero-muted">Per portion</p>
        <p className="mt-1 flex items-baseline gap-1.5">
          <span className="disp tnum text-[48px] text-sun [text-shadow:var(--glow-sun)]">{r(M.kcal)}</span>
          <span className="text-[16px] font-semibold text-hero-muted">kcal</span>
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {(
            [
              ['Protein', M.p, 'text-coral'],
              ['Carbs', M.c, 'text-sun'],
              ['Fat', M.f, 'text-violet-hi']
            ] as const
          ).map(([label, v, cls]) => (
            <div key={label} className="rounded-btn bg-white/10 px-3 py-2.5">
              <p className="text-[12px] text-hero-muted">{label}</p>
              <p className={`tnum text-[18px] font-extrabold ${cls}`}>{oneDp(v)} g</p>
            </div>
          ))}
        </div>
        {M.uncounted.length > 0 && (
          <p className="mt-3 text-[12px] leading-relaxed text-hero-muted">
            Not counted: {M.uncounted.map((u) => `${u.name} (${REASON[u.reason]})`).join(', ')}.
          </p>
        )}
      </Card>

      <section>
        <SectionTitle right="Cooked weight per portion">Ingredients</SectionTitle>
        <div className="rounded-card border border-line bg-surface">
          {lines.length === 0 && <p className="px-4 py-3 text-[13px] text-muted">No ingredients yet.</p>}
          {lines.map((l, i) => {
            const ing = ingOf(l.ingredient_id);
            const u = M.uncounted.find((x) => x.line.key === l.key);
            // Ask how much one unit weighs, only for a unit this line uses and the ingredient lacks.
            const ask = ing && u?.reason === 'no unit size' && !l.skip_weight ? ing : null;
            return (
              <div key={l.key} className="border-line [&+&]:border-t">
              <div className="flex items-center gap-2 py-2 pl-3.5 pr-1">
                <button type="button" onClick={() => ing && setEditIng(ing)} className="min-w-0 flex-1 text-left">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate font-semibold">{ing?.name ?? 'Removed ingredient'}</span>
                    {ing?.ask && <span className="rounded-[6px] bg-coral-soft px-1.5 text-[11px] font-extrabold text-coral-ink">Type?</span>}
                  </span>
                  {u && <span className="block text-[12px] text-sun-ink">Not counted: {REASON[u.reason]}</span>}
                </button>
                <input
                  inputMode="decimal"
                  aria-label={`Amount of ${ing?.name ?? 'ingredient'}`}
                  value={l.qty}
                  placeholder="–"
                  onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))}
                  className="tnum h-10 w-16 rounded-ctl border border-line2 bg-bg text-center text-[16px]"
                />
                <select
                  aria-label={`Unit for ${ing?.name ?? 'ingredient'}`}
                  value={l.unit}
                  onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, unit: e.target.value as Unit } : x)))}
                  className="h-10 w-[74px] rounded-ctl border border-line2 bg-bg px-1 text-[14px]"
                >
                  {UNITS.map((unit) => (
                    <option key={unit}>{unit}</option>
                  ))}
                </select>
                <button
                  type="button"
                  aria-label={`Remove ${ing?.name ?? 'ingredient'}`}
                  onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
                  className="inline-flex h-10 w-9 items-center justify-center text-muted"
                >
                  <X size={16} aria-hidden />
                </button>
              </div>
              {ask && (
                <UnitWeightAsk
                  ingredient={ask}
                  unit={l.unit}
                  onUse={(g) => void saveIngredient({ ...dataOf<IngredientData>(ask), grams_per: { ...ask.grams_per, [l.unit]: g } }, ask.id)}
                  onSkip={() => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, skip_weight: true } : x)))}
                />
              )}
              {l.skip_weight && u?.reason === 'no unit size' && (
                <p className="px-3.5 pb-2 text-[12px] text-muted">
                  Weight of 1 {l.unit} skipped ·{' '}
                  <button type="button" className="font-bold underline" onClick={() => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, skip_weight: false } : x)))}>
                    Add it
                  </button>
                </p>
              )}
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setPicker(true)}
          className="mt-2.5 inline-flex h-[38px] items-center gap-1.5 rounded-ctl border border-line bg-surface px-3.5 text-[13px] font-bold"
        >
          <Plus size={14} strokeWidth={2.5} aria-hidden />
          Add ingredient
        </button>
      </section>

      <Field label="Recipe link (optional)" hint={linkNorm === null ? "That isn't a web address." : linkNorm ? `Opens ${siteName(linkNorm)}` : 'Instagram, TikTok, YouTube or any web page'}>
        {(id) => <input id={id} value={link} onChange={(e) => setLink(e.target.value)} inputMode="url" autoCapitalize="none" placeholder="instagram.com/reel/…" className={inputClass} />}
      </Field>
      {linkNorm && (
        <a href={linkNorm} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center justify-center gap-2 rounded-btn bg-chip px-4 font-semibold">
          <ExternalLink size={17} aria-hidden />
          Open recipe · {siteName(linkNorm)}
        </a>
      )}

      {error && <Notice tone="rose">{error}</Notice>}
      {saved && <Notice tone="green">Saved.</Notice>}
      <Button variant="sun" onClick={() => void save()}>
        {meal ? 'Save meal' : 'Add meal'}
      </Button>
      {meal && (
        <Button variant="danger" onClick={() => void remove()}>
          {confirm ? 'Tap again to delete' : 'Delete meal'}
        </Button>
      )}

      <IngredientPicker
        open={picker}
        exclude={new Set(lines.map((l) => l.ingredient_id))}
        onClose={() => setPicker(false)}
        onPick={add}
        onCreate={(n) => {
          setPicker(false);
          setNewIng(n);
        }}
        onCreateFrom={(r) => {
          setPicker(false);
          setFromDb(r);
        }}
      />
      <IngredientSheet ingredient={editIng} open={!!editIng} onClose={() => setEditIng(null)} />
      <IngredientSheet
        newName={newIng ?? ''}
        fromDatabase={fromDb}
        open={newIng !== null || fromDb !== null}
        onClose={() => {
          setNewIng(null);
          setFromDb(null);
        }}
        onSaved={(id) => setLines((ls) => [...ls, { key: crypto.randomUUID(), ingredient_id: id, qty: '', unit: 'g' }])}
      />
    </>
  );
}

/**
 * "How much does 1 clove weigh? About 5 g" on a recipe line, with one-tap
 * "Use 5 g" and "Skip". "whole" has no default, so it asks for a figure.
 */
function UnitWeightAsk({ ingredient, unit, onUse, onSkip }: { ingredient: Ingredient; unit: Unit; onUse: (grams: number) => void; onSkip: () => void }) {
  const [typed, setTyped] = useState('');
  const def = UNIT_DEFAULTS[unit];
  const what = unit === 'whole' ? '1 whole one' : `1 ${unit}`;
  const g = parseDecimal(typed);
  return (
    <div className="mx-3.5 mb-2.5 rounded-btn bg-sun-soft px-3 py-2.5 text-[13px] text-sun-ink">
      <p className="font-semibold">
        {ingredient.name}: how much does {what} weigh?{def ? ` About ${def} g.` : ''}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {def && (
          <button type="button" onClick={() => onUse(def)} className="h-9 rounded-ctl bg-sun px-3 font-bold text-hero">
            Use {def} g
          </button>
        )}
        <input
          inputMode="decimal"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={def ? 'Other' : 'grams'}
          aria-label={`Grams in ${what} of ${ingredient.name}`}
          className="tnum h-9 w-20 rounded-ctl border border-line2 bg-surface px-2 text-center text-[15px] text-ink"
        />
        {typed.trim() && (
          <button type="button" disabled={!(g > 0)} onClick={() => onUse(Math.round(g * 10) / 10)} className="h-9 rounded-ctl border border-line bg-surface px-3 font-bold text-ink">
            Use {g > 0 ? `${oneDp(g)} g` : ''}
          </button>
        )}
        <button type="button" onClick={onSkip} className="h-9 px-2 font-bold underline">
          Skip
        </button>
      </div>
    </div>
  );
}

