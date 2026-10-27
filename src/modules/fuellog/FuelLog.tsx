import { useState } from 'react';
import { Apple, ChevronLeft, ChevronRight, Plus, UserRound, X } from 'lucide-react';
import { LineChart } from '@/components/charts';
import { Button, Card, IconButton, Notice, ProgressBar, ProgressRing, SectionTitle } from '@/components/ui';
import { addDays, fromISODate, startOfWeek, todayISO, toISODate } from '@/lib/date';
import { oneDp } from '@/lib/number';
import FoodSheet, { type FoodDraft } from './FoodSheet';
import FoodsSheet from './FoodsSheet';
import ProfileSheet from './ProfileSheet';
import { FuelLogProvider, useFuelLog } from './store';
import { dayStatus, totals, type DayStatus } from './targets';
import { GOALS, MEALS, amountLabel, type Meal } from './types';
import WeightSheet from './WeightSheet';
import { useAuth } from '@/lib/auth';
import EatSheet, { type EatTarget } from '@/modules/mealprep/EatSheet';
import { useMealFoods } from '@/modules/mealprep/mealFoods';
import { MealPrepProvider, useOptionalMealPrep } from '@/modules/mealprep/store';
import type { MealType } from '@/modules/mealprep/types';

const num = (n: number) => Math.round(n).toLocaleString('en-GB');
const dayLabel = (iso: string) =>
  fromISODate(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const shortDate = (iso: string) => fromISODate(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

// Status colours for the week grid, each paired with a legend label.
const STATUS: Record<DayStatus, { cls: string; label: string }> = {
  ok: { cls: 'bg-green', label: 'Within target' },
  over: { cls: 'bg-rose', label: 'Over' },
  none: { cls: 'bg-line2', label: 'Not logged' },
  future: { cls: 'bg-chip', label: 'Still to come' }
};

export default function FuelLog() {
  return (
    <FuelLogProvider>
      {/* Meal Prep supplies planned meals ("I ate this") and meals as foods. */}
      <MealPrepProvider>
        <Dashboard />
      </MealPrepProvider>
    </FuelLogProvider>
  );
}

function Dashboard() {
  const { loading, error, profile, targetsOn, entries, weights, hasSample, clearSample, deleteWeight } = useFuelLog();
  const today = todayISO();
  const [date, setDate] = useState(today);
  const [food, setFood] = useState<FoodDraft | null>(null);
  const [sheet, setSheet] = useState<'foods' | 'profile' | 'weight' | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [eat, setEat] = useState<EatTarget | null>(null);
  const { user } = useAuth();
  const mealPrep = useOptionalMealPrep();
  const mealFoods = useMealFoods();

  if (loading) return <p className="py-10 text-center text-muted">Loading Fuel Log…</p>;
  if (error) return <Notice tone="rose">{error}</Notice>;

  const T = targetsOn(date);
  const day = entries.filter((e) => e.date === date);
  const F = totals(day);
  const left = T ? T.kcal - F.kcal : 0;
  const over = left < 0;
  const isToday = date === today;
  const goal = GOALS.find((g) => g.id === profile?.goal)?.label.toLowerCase() ?? '';
  const logFood = (meal: Meal = 'breakfast') => setFood({ date, meal });

  const monday = toISODate(startOfWeek(fromISODate(date)));
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = toISODate(addDays(fromISODate(monday), i));
    return { d, status: dayStatus(d, today, entries, targetsOn(d)?.kcal ?? null) };
  });
  const onTarget = week.filter((w) => w.status === 'ok').length;
  const logged = week.filter((w) => w.status === 'ok' || w.status === 'over').length;

  const lastW = weights[weights.length - 1];
  const firstW = weights[0];
  const change = lastW && firstW ? Math.round((lastW.kg - firstW.kg) * 10) / 10 : 0;

  return (
    <>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setSheet('foods')}
          className="inline-flex h-[38px] items-center gap-1.5 rounded-ctl border border-line bg-surface px-3.5 text-[13px] font-bold"
        >
          <Apple size={15} aria-hidden />
          My foods
        </button>
        <button
          type="button"
          onClick={() => setSheet('profile')}
          className="inline-flex h-[38px] items-center gap-1.5 rounded-ctl border border-line bg-surface px-3.5 text-[13px] font-bold"
        >
          <UserRound size={15} aria-hidden />
          Profile
        </button>
      </div>

      {profile?.sample && (
        <Notice tone="sun">
          <span className="block">Your targets come from a sample profile.</span>
          <button type="button" className="mt-1 font-bold underline" onClick={() => setSheet('profile')}>
            Set up your profile
          </button>
        </Notice>
      )}

      <div className="flex items-center justify-between">
        <IconButton icon={ChevronLeft} label="Previous day" onClick={() => setDate(toISODate(addDays(fromISODate(date), -1)))} />
        <button type="button" onClick={() => setDate(today)} className="text-center">
          <span className="block text-[16px] font-extrabold">{isToday ? 'Today' : dayLabel(date)}</span>
          <span className="block text-[13px] text-muted">{isToday ? dayLabel(date) : 'Tap for today'}</span>
        </button>
        <IconButton
          icon={ChevronRight}
          label="Next day"
          disabled={isToday}
          onClick={() => setDate(toISODate(addDays(fromISODate(date), 1)))}
        />
      </div>

      {/* Hero: calories left */}
      <Card dark className="flex flex-col items-center !p-5">
        <ProgressRing
          value={T ? F.kcal / T.kcal : 0}
          size={220}
          stroke={18}
          tone={over ? 'rose' : 'green'}
          track="text-white/10"
          label={`${num(F.kcal)} of ${T ? num(T.kcal) : '–'} calories eaten`}
        >
          <div className="flex flex-col items-center">
            <span
              className={`disp tnum text-[64px] ${over ? 'text-rose' : 'text-green-hi'}`}
              style={{ textShadow: over ? undefined : 'var(--glow-green)' }}
            >
              {T ? num(Math.abs(left)) : '–'}
            </span>
            <span className="mt-1.5 text-[14px] text-hero-muted">
              {over ? 'calories over' : 'calories left'}
              {isToday ? ' today' : ''}
            </span>
          </div>
        </ProgressRing>
        <div className="mt-4 grid w-full grid-cols-2 gap-2.5">
          <div className="rounded-card bg-white/10 px-3.5 py-3">
            <p className="text-[12px] text-hero-muted">Eaten</p>
            <p className="disp tnum mt-0.5 text-[22px]">{num(F.kcal)}</p>
          </div>
          <button type="button" onClick={() => setSheet('profile')} className="rounded-card bg-white/10 px-3.5 py-3 text-left">
            <p className="text-[12px] text-hero-muted">Target · {goal}</p>
            <p className="disp tnum mt-0.5 text-[22px]">{T ? num(T.kcal) : '–'}</p>
          </button>
        </div>
      </Card>

      <Button variant="green" icon={Plus} onClick={() => logFood()}>
        Log food
      </Button>

      {hasSample && (
        <Notice tone="sun">
          <span className="block">Today's meals and the weigh-ins are sample data.</span>
          <button
            type="button"
            className="mt-1 font-bold underline"
            onClick={async () => {
              if (!confirmClear) return setConfirmClear(true);
              await clearSample();
              setConfirmClear(false);
            }}
          >
            {confirmClear ? 'Tap again to clear them' : 'Clear sample data'}
          </button>
        </Notice>
      )}

      <Card className="flex flex-col gap-3.5">
        {(
          [
            ['Protein', F.p, T?.protein ?? 0, 'coral'],
            ['Carbs', F.c, T?.carbs ?? 0, 'sun'],
            ['Fat', F.f, T?.fat ?? 0, 'violet']
          ] as const
        ).map(([label, v, t, tone]) => (
          <div key={label}>
            <div className="flex justify-between text-[14px]">
              <span className="font-bold">{label}</span>
              <span className="tnum text-muted">
                <b className="text-ink">{Math.round(v)}</b> / {t} g
              </span>
            </div>
            <div className="mt-1.5">
              <ProgressBar value={t ? v / t : 0} tone={tone} label={`${label} ${Math.round(v)} of ${t} g`} />
            </div>
          </div>
        ))}
      </Card>

      <section>
        <SectionTitle>{isToday ? "Today's meals" : 'Meals'}</SectionTitle>
        <div className="rounded-card border border-line bg-surface pb-2 pt-1">
          {MEALS.map((m, mi) => {
            const items = day.filter((e) => e.meal === m.id).sort((a, b) => a.created_at.localeCompare(b.created_at));
            const k = totals(items).kcal;
            return (
              <div key={m.id} className={mi ? 'mt-2 border-t border-line' : ''}>
                <div className="flex items-center justify-between px-4 pb-1 pt-2.5 text-[13px] font-bold text-muted">
                  <span>
                    {m.label}
                    {items.length > 0 && ` · ${num(k)} kcal`}
                  </span>
                  <button
                    type="button"
                    onClick={() => logFood(m.id)}
                    className="h-8 rounded-chip bg-green-soft px-3 text-[13px] font-bold text-green-ink"
                  >
                    + Add
                  </button>
                </div>
                {(() => {
                  // A planned meal you're eating that you haven't logged yet.
                  const planned = mealPrep?.plan.find((p) => p.date === date && p.slot === m.id && user && p.eaters.includes(user.id));
                  const meal = planned && mealFoods.find((f) => f.id === planned.meal_id);
                  if (!meal || items.some((e) => e.meal_id === meal.id)) return null;
                  return (
                    <div className="flex items-center justify-between gap-2 px-4 py-1.5 text-[15px]">
                      <span className="min-w-0">
                        <span className="text-muted">Planned:</span> {meal.name}
                      </span>
                      {date <= today && (
                        <button
                          type="button"
                          onClick={() => setEat({ date, slot: m.id as MealType, meal })}
                          className="h-8 shrink-0 rounded-chip bg-green-soft px-3 text-[13px] font-bold text-green-ink"
                        >
                          I ate this
                        </button>
                      )}
                    </div>
                  );
                })()}
                {items.length === 0 && !mealPrep?.plan.some((p) => p.date === date && p.slot === m.id) && (
                  <p className="px-4 py-1 text-[13px] text-muted">Nothing logged</p>
                )}
                {items.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => setFood({ date, meal: e.meal, entry: e })}
                    className="flex w-full items-center justify-between gap-2 px-4 py-1.5 text-left text-[15px]"
                  >
                    <span className="min-w-0">
                      {e.name} <span className="text-muted">{amountLabel(e)}</span>
                    </span>
                    <span className="tnum font-semibold">{num(e.kcal * e.servings)}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </section>

      <Card>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-[18px] font-bold">Week of {shortDate(monday)}</h2>
          <span className="text-[13px] text-muted">
            {onTarget} of {logged} on target
          </span>
        </div>
        <div className="mt-3.5 grid grid-cols-7 gap-1.5">
          {week.map(({ d, status }, i) => {
            const sel = d === date;
            return (
              <button
                key={d}
                type="button"
                disabled={status === 'future'}
                aria-pressed={sel}
                aria-label={`${dayLabel(d)}: ${STATUS[status].label}`}
                onClick={() => setDate(d)}
                className={`flex flex-col items-center gap-1.5 text-[12px] ${sel ? 'font-extrabold text-ink' : 'text-muted'}`}
              >
                <span
                  className={`block aspect-square w-full max-w-[40px] rounded-chip ${STATUS[status].cls} ${
                    sel ? 'outline outline-[3px] outline-offset-2 outline-ink' : ''
                  }`}
                />
                {'MTWTFSS'[i]}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-3.5 gap-y-1 text-[12px] text-muted">
          {(['ok', 'over', 'none'] as const).map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-[3px] ${STATUS[s].cls}`} aria-hidden />
              {STATUS[s].label}
            </span>
          ))}
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-[18px] font-bold">Weight</h2>
          <button
            type="button"
            onClick={() => setSheet('weight')}
            className="inline-flex h-[38px] items-center gap-1.5 rounded-ctl border border-line bg-surface px-3.5 text-[13px] font-bold"
          >
            <Plus size={14} strokeWidth={2.5} aria-hidden />
            Log weight
          </button>
        </div>
        {lastW && (
          <div className="mt-2.5 flex flex-wrap items-baseline gap-2">
            <span className="disp tnum text-[40px]">{oneDp(lastW.kg)} kg</span>
            {weights.length > 1 && (
              <span className={`text-[13px] font-bold ${change <= 0 ? 'text-green-ink' : 'text-coral-ink'}`}>
                {change > 0 ? '+' : change < 0 ? '−' : ''}
                {oneDp(Math.abs(change))} kg since {shortDate(firstW.date)}
              </span>
            )}
          </div>
        )}
        <div className="mt-3">
          <LineChart
            points={weights.slice(-10).map((w) => ({ label: shortDate(w.date), value: w.kg }))}
            color="rgb(var(--green-ink))"
            area="rgb(var(--green-soft))"
            label="Body weight trend"
            step={0.5}
            format={(v) => `${oneDp(v)} kg`}
            empty="Log your weight to see the trend."
          />
        </div>
        {weights.length > 0 && (
          <ul className="mt-2">
            {[...weights].reverse().slice(0, 4).map((w) => (
              <li key={w.id} className="flex items-center justify-between border-t border-line py-1">
                <span className="text-[13px] text-muted">{dayLabel(w.date)}</span>
                <span className="flex items-center gap-0.5">
                  <b className="tnum">{oneDp(w.kg)} kg</b>
                  <button
                    type="button"
                    aria-label={`Remove weight for ${dayLabel(w.date)}`}
                    onClick={() => void deleteWeight(w.id)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-ctl text-muted"
                  >
                    <X size={16} aria-hidden />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <FoodSheet draft={food} onClose={() => setFood(null)} />
      <FoodsSheet
        open={sheet === 'foods'}
        onClose={() => setSheet(null)}
      />
      <ProfileSheet open={sheet === 'profile'} onClose={() => setSheet(null)} />
      <WeightSheet open={sheet === 'weight'} onClose={() => setSheet(null)} />
      <EatSheet target={eat} onClose={() => setEat(null)} />
    </>
  );
}
