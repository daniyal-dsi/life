import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ChevronLeft, Minus, Plus, ScanBarcode } from 'lucide-react';
import { BottomSheet, Button, Field, Notice, inputClass } from '@/components/ui';
import BarcodeScanner from '@/lib/nutrition/BarcodeScanner';
import { loadCofid, searchFoods } from '@/lib/nutrition/cofid';
import { lookupBarcode } from '@/lib/nutrition/off';
import type { FoodResult, Nutrition } from '@/lib/nutrition/types';
import { searchUsda } from '@/lib/nutrition/usda';
import { oneDp, parseDecimal } from '@/lib/number';
import { isDemo } from '@/lib/supabase';
import { useMealFoods, type MealFood } from '@/modules/mealprep/mealFoods';
import { useFuelLog } from './store';
import { MEALS, amountLabel, type Entry, type EntryData, type Food, type Meal } from './types';

// Log food: one search box. My Foods, Meal Prep meals and recent foods first,
// then CoFID, USDA and a barcode scan (Open Food Facts); typing it in by hand
// is the last option. Then pick the amount (grams, or servings when the food
// has a serving size) and the mealtime. Used from the Fuel Log and from Home.

export type FoodDraft = { date: string; meal: Meal; entry?: Entry };

type Picked =
  | { kind: 'food'; food: Food }
  | { kind: 'meal'; meal: MealFood }
  | { kind: 'result'; result: FoodResult }
  | { kind: 'entry'; entry: Entry };

/** What a picked food offers: values per 100 g and/or per serving. */
type Basis = {
  name: string;
  per100: Nutrition | null;
  perServing: Nutrition | null;
  servingGrams: number | null;
  servingLabel: string | null;
};

const num = (n: number) => Math.round(n).toLocaleString('en-GB');
const r1 = (n: number) => Math.round(n * 10) / 10;
const scale = (n: Nutrition, k: number): Nutrition => ({ kcal: n.kcal * k, p: n.p * k, c: n.c * k, f: n.f * k });
const nut = (x: { kcal: number; p: number | null; c: number | null; f: number | null }): Nutrition => ({ kcal: x.kcal, p: x.p ?? 0, c: x.c ?? 0, f: x.f ?? 0 });

/** Name a database result is saved and logged under (scanned products keep their brand). */
const resultName = (r: FoodResult) => (r.detail && r.source === 'Open Food Facts' ? `${r.name} (${r.detail.split(' · ')[0]})` : r.name);

function basisOf(p: Picked): Basis {
  if (p.kind === 'meal') return { name: p.meal.name, per100: null, perServing: nut(p.meal), servingGrams: null, servingLabel: '1 portion' };
  if (p.kind === 'result') {
    const r = p.result;
    const sg = r.servingGrams ?? null;
    return { name: resultName(r), per100: r.nutrition, perServing: sg ? scale(r.nutrition, sg / 100) : null, servingGrams: sg, servingLabel: r.servingLabel ?? null };
  }
  const x = p.kind === 'food' ? p.food : p.entry;
  if (x.per_100g) {
    const sg = x.serving_grams ?? null;
    return { name: x.name, per100: x.per_100g, perServing: sg ? scale(x.per_100g, sg / 100) : null, servingGrams: sg, servingLabel: x.serving_label ?? null };
  }
  // Hand-made foods and older entries are per serving.
  return { name: x.name, per100: null, perServing: nut(x), servingGrams: null, servingLabel: x.serving_label ?? null };
}

export default function FoodSheet({ draft, onClose }: { draft: FoodDraft | null; onClose: () => void }) {
  const { foods, entries, saveFood, saveEntry, deleteEntry } = useFuelLog();
  const mealFoods = useMealFoods();
  const [meal, setMeal] = useState<Meal>('breakfast');
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Picked | null>(null);
  const [mode, setMode] = useState<'g' | 'serving'>('serving');
  const [amount, setAmount] = useState('1');
  const [cofid, setCofid] = useState<FoodResult[] | null>(null);
  const [usda, setUsda] = useState<FoodResult[] | null>(null);
  const [scan, setScan] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [manual, setManual] = useState<{ name: string; kcal: string; p: string; c: string; f: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const editing = draft?.entry;

  useEffect(() => {
    if (!draft) return;
    setMeal(draft.entry?.meal ?? draft.meal);
    setQ('');
    setUsda(null);
    setScan(false);
    setBarcode('');
    setManual(null);
    setError(null);
    if (draft.entry) choose({ kind: 'entry', entry: draft.entry }, draft.entry);
    else setPicked(null);
    loadCofid().then(setCofid, () => setCofid([]));
  }, [draft]);

  useEffect(() => setUsda(null), [q]);

  /** Selects a food and sets a sensible starting amount. */
  function choose(p: Picked, from?: Entry) {
    const b = basisOf(p);
    setPicked(p);
    setError(null);
    if (from) {
      if (from.grams && b.per100) {
        setMode('g');
        setAmount(String(Math.round(from.grams)));
      } else {
        setMode('serving');
        setAmount(oneDp(from.servings));
      }
      return;
    }
    if (b.perServing) {
      setMode('serving');
      setAmount('1');
    } else {
      setMode('g');
      setAmount('100');
    }
  }

  // Recent foods: the last different things logged.
  const recent = useMemo(() => {
    const seen = new Set<string>();
    const out: Picked[] = [];
    for (const e of [...entries].sort((a, b) => b.created_at.localeCompare(a.created_at))) {
      const key = e.meal_id ?? e.food_id;
      if (seen.has(key)) continue;
      seen.add(key);
      const food = foods.find((f) => f.id === e.food_id);
      const m = e.meal_id ? mealFoods.find((x) => x.id === e.meal_id) : undefined;
      out.push(food ? { kind: 'food', food } : m ? { kind: 'meal', meal: m } : { kind: 'entry', entry: e });
      if (out.length >= 6) break;
    }
    return out;
  }, [entries, foods, mealFoods]);

  const term = q.trim().toLowerCase();
  // Every typed word must appear, ignoring punctuation ("porridge made with water" finds "Porridge, made with water").
  const words = term.split(/[^a-z0-9%é]+/).filter(Boolean);
  const matches = (name: string) => {
    const n = name.toLowerCase();
    return words.every((w) => n.includes(w));
  };
  const myFoods = foods.filter((f) => matches(f.name)).slice(0, term ? 20 : 30);
  const meals = mealFoods.filter((m) => matches(m.name));
  const saved = (r: FoodResult) => foods.some((f) => f.source === r.source && f.ref === r.ref);
  const dbResults = cofid && term.length > 1 ? searchFoods(cofid, term, 10).filter((r) => !saved(r)) : [];

  async function findUsda() {
    setBusy(true);
    setError(null);
    try {
      setUsda((await searchUsda(q)).filter((r) => !saved(r)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'USDA search failed.');
    } finally {
      setBusy(false);
    }
  }

  async function look(code: string) {
    setBusy(true);
    setError(null);
    try {
      const r = await lookupBarcode(code);
      if (!r) return setError(`Barcode ${code} isn't on Open Food Facts. Enter it by hand from the pack.`);
      const known = foods.find((f) => f.source === r.source && f.ref === r.ref);
      setScan(false);
      choose(known ? { kind: 'food', food: known } : { kind: 'result', result: r });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lookup failed.');
    } finally {
      setBusy(false);
    }
  }

  async function addManual(e: FormEvent) {
    e.preventDefault();
    if (!manual) return;
    const kcal = parseDecimal(manual.kcal);
    if (!manual.name.trim()) return setError('Give the food a name.');
    if (!(kcal >= 0)) return setError('Enter the calories per serving.');
    const m = (s: string) => (s.trim() && parseDecimal(s) >= 0 ? r1(parseDecimal(s)) : null);
    const data = { name: manual.name.trim(), kcal: Math.round(kcal), p: m(manual.p), c: m(manual.c), f: m(manual.f), source: 'Manual' as const };
    const id = await saveFood(data);
    setManual(null);
    choose({ kind: 'food', food: { ...data, id, created_at: '', updated_at: '' } });
  }

  const b = picked ? basisOf(picked) : null;
  const amt = parseDecimal(amount);
  const total: Nutrition | null =
    b && amt > 0 ? (mode === 'g' && b.per100 ? scale(b.per100, amt / 100) : b.perServing ? scale(b.perServing, amt) : null) : null;

  const step = (d: number) =>
    setAmount((cur) => {
      const n = parseDecimal(cur);
      const base = Number.isFinite(n) ? n : mode === 'g' ? 100 : 1;
      return mode === 'g' ? String(Math.max(5, Math.round(base + d * 10))) : oneDp(Math.max(0.5, base + d * 0.5));
    });

  async function save() {
    if (!draft || !picked || !b) return;
    if (!(amt > 0) || (mode === 'serving' && amt > 50) || (mode === 'g' && amt > 5000)) return setError(mode === 'g' ? 'Enter the grams eaten.' : 'Servings must be a number above 0.');
    setBusy(true);
    try {
      // A searched or scanned food goes into My Foods (once: matched on source + ref).
      let foodId: string;
      if (picked.kind === 'result') {
        const r = picked.result;
        const known = foods.find((f) => f.source === r.source && f.ref === r.ref);
        const per = r.servingGrams ? scale(r.nutrition, r.servingGrams / 100) : r.nutrition;
        foodId =
          known?.id ??
          (await saveFood({
            name: resultName(r),
            kcal: Math.round(per.kcal),
            p: r1(per.p),
            c: r1(per.c),
            f: r1(per.f),
            source: r.source,
            ref: r.ref,
            per_100g: r.nutrition,
            serving_grams: r.servingGrams ?? null,
            serving_label: r.servingLabel ?? null
          }));
      } else foodId = picked.kind === 'food' ? picked.food.id : picked.kind === 'meal' ? picked.meal.id : picked.entry.food_id;

      // Entries keep a copy of the values at the time, plus the grams or servings used.
      const values: Nutrition = mode === 'g' ? b.per100! : b.perServing!;
      const data: EntryData = {
        date: draft.date,
        meal,
        food_id: foodId,
        name: b.name,
        kcal: Math.round(values.kcal * 10) / 10,
        p: r1(values.p),
        c: r1(values.c),
        f: r1(values.f),
        servings: mode === 'g' ? Math.round(amt * 100) / 10000 : Math.round(amt * 100) / 100,
        grams: mode === 'g' ? Math.round(amt) : null,
        per_100g: b.per100,
        serving_grams: b.servingGrams,
        serving_label: b.servingLabel
      };
      if (picked.kind === 'meal') data.meal_id = picked.meal.id;
      else if (picked.kind === 'entry' && picked.entry.meal_id) data.meal_id = picked.entry.meal_id;
      await saveEntry(data, editing?.id);
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

  const row = (key: string, p: Picked, title: string, sub: string, kcal: string, tag?: string, dashed = false) => (
    <button
      key={key}
      type="button"
      onClick={() => choose(p)}
      className={`flex w-full items-center justify-between gap-2.5 rounded-btn border px-3.5 py-3 text-left ${dashed ? 'border-dashed border-line2' : 'border-line bg-bg'}`}
    >
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-1.5 font-bold leading-snug">
          {title}
          {tag && <span className="rounded-[6px] bg-sun-soft px-1.5 text-[11px] font-extrabold text-sun-ink">{tag}</span>}
        </span>
        <span className="text-[12px] text-muted">{sub}</span>
      </span>
      <span className="tnum whitespace-nowrap text-[14px] font-bold">{kcal}</span>
    </button>
  );
  const foodSub = (f: Food) => (f.per_100g ? `${f.source} · ${f.serving_label ? `per ${f.serving_label}` : 'per 100 g'}` : 'My food · per serving');
  const label = (title: string) => <p className="mt-1 text-[12px] font-bold text-muted">{title}</p>;

  return (
    <BottomSheet open={!!draft} onClose={onClose} title={editing ? `Edit ${editing.name}` : 'Log food'}>
      {!picked ? (
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search foods, e.g. porridge" aria-label="Search foods" autoComplete="off" className={inputClass} />
            <button
              type="button"
              aria-label="Scan barcode"
              onClick={() => setScan((s) => !s)}
              className={`inline-flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-btn border ${scan ? 'border-green bg-green-soft text-green-ink' : 'border-line2 bg-surface'}`}
            >
              <ScanBarcode size={22} aria-hidden />
            </button>
          </div>

          {scan && (
            <div className="flex flex-col gap-2">
              <BarcodeScanner onCode={(c) => void look(c)} />
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void look(barcode);
                }}
                className="flex gap-2"
              >
                <input value={barcode} onChange={(e) => setBarcode(e.target.value)} inputMode="numeric" placeholder="Or type the barcode" aria-label="Barcode number" className={`${inputClass} tnum`} />
                <button type="submit" disabled={busy} className="h-[52px] shrink-0 rounded-btn border border-line bg-surface px-4 font-bold">
                  Look up
                </button>
              </form>
            </div>
          )}

          <div className="flex max-h-[46dvh] flex-col gap-2 overflow-y-auto">
            {!term && recent.length > 0 && label('Recent')}
            {!term &&
              recent.map((p, i) => {
                const rb = basisOf(p);
                const per = rb.perServing ?? rb.per100;
                return row(`r${i}`, p, rb.name, rb.perServing ? (rb.servingLabel ? `per ${rb.servingLabel}` : 'per serving') : 'per 100 g', per ? `${num(per.kcal)} kcal` : '', p.kind === 'meal' ? 'Meal Prep' : undefined);
              })}
            {myFoods.length > 0 && label('My Foods')}
            {myFoods.map((f) => row(f.id, { kind: 'food', food: f }, f.name, foodSub(f), `${num(f.kcal)} kcal`))}
            {meals.length > 0 && label('Meal Prep meals (one portion)')}
            {meals.map((m) => row(m.id, { kind: 'meal', meal: m }, m.name, `P ${oneDp(m.p)} · C ${oneDp(m.c)} · F ${oneDp(m.f)} g`, `${num(m.kcal)} kcal`, 'Meal Prep'))}
            {dbResults.length > 0 && label('UK food database (CoFID), per 100 g')}
            {dbResults.map((r) => row(`c${r.ref}`, { kind: 'result', result: r }, r.name, `P ${r.nutrition.p} · C ${r.nutrition.c} · F ${r.nutrition.f} g`, `${r.nutrition.kcal} kcal`, undefined, true))}
            {usda && usda.length > 0 && label('USDA, per 100 g')}
            {usda?.map((r) => row(`u${r.ref}`, { kind: 'result', result: r }, r.name, `P ${r.nutrition.p} · C ${r.nutrition.c} · F ${r.nutrition.f} g`, `${r.nutrition.kcal} kcal`, undefined, true))}
            {term.length > 1 && !myFoods.length && !meals.length && !dbResults.length && !usda?.length && (
              <p className="text-[13px] text-muted">Nothing found yet. Try USDA, scan the barcode, or enter it by hand.</p>
            )}
          </div>

          {term.length > 1 && !usda && (
            <Button variant="secondary" onClick={() => void findUsda()} disabled={busy || isDemo}>
              {busy ? 'Searching USDA…' : isDemo ? 'USDA search needs Supabase' : 'Search USDA too'}
            </Button>
          )}

          {manual ? (
            <form onSubmit={(e) => void addManual(e)} className="flex flex-col gap-2.5 rounded-card border border-line bg-bg p-3.5">
              <p className="font-extrabold">Enter it by hand (per serving)</p>
              <Field label="Name">{(id) => <input id={id} value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} className={inputClass} />}</Field>
              <div className="grid grid-cols-4 gap-2">
                {(['kcal', 'p', 'c', 'f'] as const).map((k) => (
                  <Field key={k} label={{ kcal: 'kcal', p: 'Protein', c: 'Carbs', f: 'Fat' }[k]}>
                    {(id) => <input id={id} inputMode="decimal" value={manual[k]} onChange={(e) => setManual({ ...manual, [k]: e.target.value })} className={`${inputClass} tnum px-1.5 text-center`} />}
                  </Field>
                ))}
              </div>
              <Button type="submit" variant="green">
                Save to My Foods
              </Button>
            </form>
          ) : (
            <button type="button" onClick={() => setManual({ name: q.trim(), kcal: '', p: '', c: '', f: '' })} className="self-start text-[13px] font-bold underline">
              Not listed? Enter it by hand
            </button>
          )}
          {error && <Notice tone="rose">{error}</Notice>}
          <p className="text-[11px] leading-relaxed text-muted">
            CoFID: McCance and Widdowson's Composition of Foods 2021. Contains public sector information licensed under the Open Government Licence v3.0. Also USDA
            FoodData Central and Open Food Facts (ODbL).
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {!editing && (
            <button type="button" onClick={() => setPicked(null)} className="inline-flex items-center gap-1 self-start text-[13px] font-bold">
              <ChevronLeft size={16} aria-hidden />
              Change food
            </button>
          )}
          <div>
            <p className="text-[17px] font-extrabold leading-snug">{b!.name}</p>
            <p className="text-[13px] text-muted">
              {b!.per100 && `${num(b!.per100.kcal)} kcal per 100 g`}
              {b!.per100 && b!.perServing && ' · '}
              {b!.perServing && `${num(b!.perServing.kcal)} kcal per ${b!.servingLabel ?? 'serving'}`}
            </p>
          </div>

          <div>
            <p className="mb-1.5 text-[13px] font-semibold text-muted">Meal</p>
            <div className="flex flex-wrap gap-2">
              {MEALS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={meal === m.id}
                  onClick={() => setMeal(m.id)}
                  className={`h-9 rounded-ctl border px-3.5 text-[14px] font-semibold ${meal === m.id ? 'border-btn bg-btn text-btn-text' : 'border-line2 bg-surface'}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="text-[13px] font-semibold text-muted">How much</p>
              {b!.per100 && b!.perServing && (
                <div className="flex rounded-ctl bg-segbg p-0.5 text-[13px] font-semibold" role="radiogroup" aria-label="Amount in">
                  {(['serving', 'g'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={mode === m}
                      onClick={() => {
                        setMode(m);
                        setAmount(m === 'g' ? String(b!.servingGrams ?? 100) : '1');
                      }}
                      className={`h-8 rounded-chip px-3 ${mode === m ? 'bg-surface text-ink' : 'text-muted'}`}
                    >
                      {m === 'g' ? 'Grams' : 'Servings'}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" aria-label="Less" onClick={() => step(-1)} className="inline-flex h-11 w-11 items-center justify-center rounded-btn bg-chip">
                <Minus size={18} aria-hidden />
              </button>
              <input
                inputMode="decimal"
                aria-label={mode === 'g' ? 'Grams' : 'Servings'}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="tnum h-11 w-20 rounded-ctl border border-line2 bg-surface text-center text-[16px]"
              />
              <button type="button" aria-label="More" onClick={() => step(1)} className="inline-flex h-11 w-11 items-center justify-center rounded-btn bg-chip">
                <Plus size={18} aria-hidden />
              </button>
              <span className="text-[14px] text-muted">{mode === 'g' ? 'g' : b!.servingLabel ? `× ${b!.servingLabel}` : 'servings'}</span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 rounded-card bg-chip p-3 text-center" aria-live="polite">
            {(
              [
                ['kcal', total?.kcal, ''],
                ['Protein', total?.p, ' g'],
                ['Carbs', total?.c, ' g'],
                ['Fat', total?.f, ' g']
              ] as const
            ).map(([l, v, u]) => (
              <div key={l}>
                <p className="disp tnum text-[22px]">{v === undefined ? '–' : l === 'kcal' ? num(v) : oneDp(v)}</p>
                <p className="text-[12px] text-muted">
                  {l}
                  {u ? ' (g)' : ''}
                </p>
              </div>
            ))}
          </div>

          {error && <Notice tone="rose">{error}</Notice>}
          <Button variant="green" onClick={() => void save()} disabled={busy || !total}>
            {editing ? 'Save changes' : `Add to ${MEALS.find((m) => m.id === meal)!.label.toLowerCase()}`}
          </Button>
          {editing && (
            <Button variant="danger" onClick={() => void remove()} disabled={busy}>
              Remove ({amountLabel(editing)})
            </Button>
          )}
        </div>
      )}
    </BottomSheet>
  );
}
