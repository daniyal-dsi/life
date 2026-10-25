import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Link2, Plus } from 'lucide-react';
import { Button, Card, Notice, Segmented, SectionTitle } from '@/components/ui';
import { todayISO } from '@/lib/date';
import { FuelLogProvider } from '@/modules/fuellog/store';
import IngredientSheet from './IngredientSheet';
import { mealFlags, mealMacros } from './macros';
import MealEditor from './MealEditor';
import { mondayOf } from './plan';
import PlanView from './PlanView';
import ShoppingView from './ShoppingView';
import { MealPrepProvider, useMealPrep } from './store';
import { AISLES, MEAL_TYPES, type Ingredient, type MealType } from './types';

// Meal Prep inside Health. Shared by the household. URL: /health?m=meal&v=...
// with &meal=<id> (or &meal=new) for the recipe editor.

type View = 'plan' | 'shopping' | 'meals' | 'ingredients';
const VIEWS: { id: View; label: string }[] = [
  { id: 'plan', label: 'Plan' },
  { id: 'shopping', label: 'Shopping' },
  { id: 'meals', label: 'Meals' },
  { id: 'ingredients', label: 'Ingredients' }
];

export default function MealPrep() {
  return (
    <MealPrepProvider>
      {/* Your Fuel Log, for "I ate this" on the plan (without seeding sample data). */}
      <FuelLogProvider seed={false}>
        <Screens />
      </FuelLogProvider>
    </MealPrepProvider>
  );
}

function Screens() {
  const { loading, error, meals } = useMealPrep();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const raw = params.get('v');
  const view: View = VIEWS.some((v) => v.id === raw) ? (raw as View) : 'plan';
  const weekParam = params.get('week');
  const monday = weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam) ? mondayOf(weekParam) : mondayOf(todayISO());
  const setMonday = (m: string) => setParams({ m: 'meal', v: view, week: m }, { replace: true });
  const mealId = params.get('meal');

  if (loading) return <p className="py-10 text-center text-muted">Loading Meal Prep…</p>;
  if (error) return <Notice tone="rose">{error}</Notice>;

  if (mealId) {
    const meal = meals.find((m) => m.id === mealId) ?? null;
    return <MealEditor key={mealId} meal={mealId === 'new' ? null : meal} onDone={() => navigate('/health?m=meal&v=meals')} />;
  }

  return (
    <>
      <Segmented label="Meal Prep" options={VIEWS} value={view} onChange={(v) => setParams({ m: 'meal', v, week: monday }, { replace: true })} />
      {view === 'plan' && <PlanView monday={monday} setMonday={setMonday} openShopping={() => setParams({ m: 'meal', v: 'shopping', week: monday }, { replace: true })} />}
      {view === 'shopping' && <ShoppingView monday={monday} setMonday={setMonday} />}
      {view === 'meals' && <MealsList />}
      {view === 'ingredients' && <IngredientsList />}
    </>
  );
}

function MealsList() {
  const { meals, ingredients } = useMealPrep();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | MealType>('all');
  const list = meals.filter((m) => filter === 'all' || m.type === filter);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {[{ id: 'all' as const, label: 'All' }, ...MEAL_TYPES].map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={filter === t.id}
            onClick={() => setFilter(t.id)}
            className={`h-9 rounded-ctl border px-3.5 text-[14px] font-semibold ${filter === t.id ? 'border-btn bg-btn text-btn-text' : 'border-line2 bg-surface'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2.5">
        {list.length === 0 && <Card className="text-[13px] text-muted">No meals here yet.</Card>}
        {list.map((m) => {
          const M = mealMacros(m.lines, ingredients);
          const flags = mealFlags(m.lines, M);
          return (
            <Link key={m.id} to={`/health?m=meal&v=meals&meal=${m.id}`} className="flex flex-col gap-1.5 rounded-card border border-line bg-surface p-4">
              <span className="flex items-start justify-between gap-2">
                <span className="font-display text-[18px] font-bold">{m.name}</span>
                {m.link && <Link2 size={16} className="mt-1 shrink-0 text-muted" aria-label="Has a recipe link" />}
              </span>
              <span className="text-[13px] text-muted">
                {MEAL_TYPES.find((t) => t.id === m.type)?.label} · <b className="tnum text-ink">{Math.round(M.kcal)} kcal</b> · P {Math.round(M.p)} · C {Math.round(M.c)} · F {Math.round(M.f)} g
              </span>
              {flags.length > 0 && (
                <span className="flex flex-wrap gap-1.5">
                  {flags.map((f) => (
                    <span key={f} className="rounded-[6px] bg-sun-soft px-2 py-0.5 text-[12px] font-semibold text-sun-ink">
                      {f}
                    </span>
                  ))}
                </span>
              )}
            </Link>
          );
        })}
      </div>
      <Button variant="sun" icon={Plus} onClick={() => navigate('/health?m=meal&v=meals&meal=new')}>
        Add a meal
      </Button>
    </>
  );
}

function IngredientsList() {
  const { ingredients } = useMealPrep();
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [adding, setAdding] = useState(false);
  const toSpecify = ingredients.filter((i) => i.ask).length;

  return (
    <>
      {toSpecify > 0 && <Notice tone="sun">{toSpecify} ingredient{toSpecify === 1 ? '' : 's'} marked Type? need a specific name. Tap one to pick.</Notice>}
      {AISLES.map((a) => {
        const list = ingredients.filter((i) => i.aisle === a.id);
        if (!list.length) return null;
        return (
          <section key={a.id}>
            <SectionTitle>{a.label}</SectionTitle>
            <div className="rounded-card border border-line bg-surface">
              {list.map((i) => (
                <button key={i.id} type="button" onClick={() => setEditing(i)} className="flex w-full items-center gap-2 border-line px-4 py-2.5 text-left [&+&]:border-t">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="font-semibold">{i.name}</span>
                      {i.ask && <span className="rounded-[6px] bg-coral-soft px-1.5 text-[11px] font-extrabold text-coral-ink">Type?</span>}
                      {i.staple && <span className="text-[12px] text-muted">staple</span>}
                    </span>
                    <span className="block text-[13px] text-muted">
                      {i.nutrition ? `${i.nutrition.kcal} kcal · P ${i.nutrition.p} · C ${i.nutrition.c} · F ${i.nutrition.f} per 100 g` : 'No nutrition yet'}
                      {i.source ? ` · ${i.source}${i.starter ? ' (starter)' : ''}` : ''}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        );
      })}
      <Button variant="sun" icon={Plus} onClick={() => setAdding(true)}>
        Add an ingredient
      </Button>
      <IngredientSheet ingredient={editing} open={!!editing} onClose={() => setEditing(null)} />
      <IngredientSheet open={adding} onClose={() => setAdding(false)} />
    </>
  );
}
