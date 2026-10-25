import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Copy, CookingPot, Link2, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { Card, IconButton, Notice, ProgressBar, SectionTitle } from '@/components/ui';
import { addDays, fromISODate, todayISO, toISODate } from '@/lib/date';
import { mealFlags, mealMacros } from './macros';
import { useEaters, useMyTargets } from './people';
import { cooks, dailyAverage, mondayOf, shoppingList, weekDates, weekPlan } from './plan';
import SlotSheet, { type SlotRef } from './SlotSheet';
import { useMealPrep } from './store';
import { AISLES, MEAL_TYPES } from './types';

const num = (n: number) => Math.round(n).toLocaleString('en-GB');
const day = (iso: string) => fromISODate(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const short = (iso: string) => fromISODate(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

function weekLabel(monday: string): string {
  const now = mondayOf(todayISO());
  if (monday === now) return 'This week';
  if (monday === toISODate(addDays(fromISODate(now), 7))) return 'Next week';
  if (monday === toISODate(addDays(fromISODate(now), -7))) return 'Last week';
  return `${short(monday)} to ${short(toISODate(addDays(fromISODate(monday), 6)))}`;
}

export default function PlanView({ monday, setMonday, openShopping }: { monday: string; setMonday: (m: string) => void; openShopping: () => void }) {
  const { meals, ingredients, plan, shopping, copyLastWeek, clearWeek } = useMealPrep();
  const eaters = useEaters();
  const me = eaters.find((e) => e.me);
  const T = useMyTargets();
  const [slot, setSlot] = useState<SlotRef | null>(null);
  const [confirm, setConfirm] = useState<'copy' | 'clear' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const today = todayISO();
  useEffect(() => {
    setMessage(null);
    setConfirm(null);
  }, [monday]);

  const week = weekPlan(plan, monday);
  const C = cooks(week, meals);
  const avg = me ? dailyAverage(week, meals, ingredients, me.id) : null;
  const list = shoppingList(week, meals, ingredients, shopping, monday, AISLES.map((a) => a.id));
  const nameOf = (id: string) => eaters.find((e) => e.id === id)?.name ?? 'Someone';
  const batchSize = (slotId: string, mealId: string) => C.find((c) => c.slot === slotId && c.meal.id === mealId)?.dates.length ?? 0;
  const shift = (n: number) => setMonday(toISODate(addDays(fromISODate(monday), 7 * n)));

  async function act(kind: 'copy' | 'clear') {
    if (confirm !== kind) return setConfirm(kind);
    setConfirm(null);
    if (kind === 'copy') {
      const n = await copyLastWeek(monday);
      setMessage(n ? `Copied ${n} meal${n === 1 ? '' : 's'} from last week.` : 'Last week had nothing planned.');
    } else {
      await clearWeek(monday);
      setMessage('Week cleared.');
    }
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <IconButton icon={ChevronLeft} label="Previous week" onClick={() => shift(-1)} />
        <button type="button" onClick={() => setMonday(mondayOf(today))} className="text-center">
          <span className="block text-[16px] font-extrabold">Week of {short(monday)}</span>
          <span className="block text-[13px] text-muted">{weekLabel(monday)}</span>
        </button>
        <IconButton icon={ChevronRight} label="Next week" onClick={() => shift(1)} />
      </div>

      <section className="kcard k-sun rounded-hero p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[14px] font-semibold">Meals planned</p>
            <p className="mt-1.5 flex items-end gap-2">
              <span className="disp knum tnum text-[88px] !leading-[0.85] !tracking-[-0.05em]">{week.length}</span>
              <span className="pb-1 text-[16px] font-semibold">of 21</span>
            </p>
          </div>
          <span className="kicon inline-flex h-[30px] items-center gap-1.5 rounded-chip px-3 text-[13px] font-extrabold">
            <CookingPot size={14} strokeWidth={2.5} aria-hidden />
            {C.length} cook{C.length === 1 ? '' : 's'}
          </span>
        </div>
        <span className="ktrack mt-3.5 block h-2 overflow-hidden rounded-[4px]">
          <span className="kbar block h-full rounded-[4px]" style={{ width: `${(week.length / 21) * 100}%` }} />
        </span>
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <div>
            <p className="disp tnum text-[30px]">{avg?.days ? num(avg.kcal) : '–'}</p>
            <p className="mt-1 text-[12px] font-semibold">kcal a day for you, from these meals</p>
          </div>
          <div>
            <p className="disp tnum text-[30px]">{list.total - list.done}</p>
            <p className="mt-1 text-[12px] font-semibold">items left to buy</p>
          </div>
        </div>
        <button type="button" onClick={openShopping} className="kslot mt-4 inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-btn text-[15px] font-extrabold">
          <ShoppingCart size={18} aria-hidden />
          Shopping list
        </button>
      </section>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void act('copy')} className="inline-flex h-[38px] items-center gap-1.5 rounded-ctl border border-line bg-surface px-3.5 text-[13px] font-bold">
          <Copy size={15} aria-hidden />
          {confirm === 'copy' ? 'Tap again: replaces this week' : 'Copy last week'}
        </button>
        <button
          type="button"
          disabled={!week.length}
          onClick={() => void act('clear')}
          className="inline-flex h-[38px] items-center gap-1.5 rounded-ctl border border-line bg-surface px-3.5 text-[13px] font-bold"
        >
          <Trash2 size={15} aria-hidden />
          {confirm === 'clear' ? 'Tap again to clear' : 'Clear week'}
        </button>
      </div>
      {message && <Notice tone="green">{message}</Notice>}

      <section className="flex flex-col gap-2.5">
        {weekDates(monday).map((d) => {
          let kcal = 0;
          let protein = 0;
          return (
            // Flex column so the day heading (rendered after the slots, once totals are known) shows first.
            <div key={d} className={`flex flex-col rounded-card border bg-surface p-3.5 ${d === today ? 'border-2 border-sun' : 'border-line'}`}>
              <div className="flex flex-col gap-2">
                {MEAL_TYPES.map(({ id: s, label }) => {
                  const p = week.find((x) => x.date === d && x.slot === s);
                  const meal = p && meals.find((m) => m.id === p.meal_id);
                  if (!p || !meal)
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSlot({ date: d, slot: s, monday })}
                        className="flex min-h-[52px] items-center gap-2.5 rounded-ctl border-[1.5px] border-dashed border-line2 px-3 text-left text-[14px] font-semibold text-muted"
                      >
                        <span className="w-[66px] shrink-0 text-[12px] font-bold">{label}</span>
                        <Plus size={16} strokeWidth={2.5} aria-hidden />
                        Add {s}
                      </button>
                    );
                  const M = mealMacros(meal.lines, ingredients);
                  if (me && p.eaters.includes(me.id)) {
                    kcal += M.kcal;
                    protein += M.p;
                  }
                  const batch = batchSize(s, meal.id);
                  const flagged = mealFlags(meal.lines, M).length > 0;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSlot({ date: d, slot: s, monday })}
                      className="flex min-h-[52px] items-center gap-2.5 rounded-ctl border border-line bg-bg px-3 py-2 text-left"
                    >
                      <span className="w-[66px] shrink-0 text-[12px] font-bold text-muted">{label}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold">{meal.name}</span>
                        <span className="tnum text-[13px] text-muted">
                          {num(M.kcal)} kcal · {p.eaters.map(nameOf).join(' & ')}
                        </span>
                      </span>
                      {meal.link && <Link2 size={15} className="shrink-0 text-muted" aria-label="Has a recipe link" />}
                      {batch > 1 && (
                        <span className="inline-flex h-6 shrink-0 items-center gap-1 rounded-chip bg-sun-soft px-2 text-[12px] font-extrabold text-sun-ink" title="Batch cooked">
                          <CookingPot size={12} strokeWidth={2.5} aria-hidden />×{batch}
                        </span>
                      )}
                      {flagged && (
                        <span className="rounded-[6px] bg-coral-soft px-2 text-[11px] font-extrabold text-coral-ink" title="Needs attention">
                          !
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="order-first mb-2.5 flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <span className="text-[16px] font-extrabold">{day(d)}</span>
                  {d === today && <span className="rounded-[5px] bg-sun px-1.5 py-0.5 text-[11px] font-extrabold text-hero">Today</span>}
                </span>
                {kcal > 0 && (
                  <span className="tnum text-[13px] text-muted">
                    You: {num(kcal)} kcal · {Math.round(protein)} g protein
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </section>

      <Card>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-[18px] font-bold">Your daily average</h2>
          <span className="text-[13px] text-muted">Planned meals you eat</span>
        </div>
        {!avg?.days ? (
          <p className="pb-1 pt-4 text-[13px] text-muted">Plan some meals to see their macros.</p>
        ) : (
          <>
            <p className="mt-2.5 flex flex-wrap items-baseline gap-1.5">
              <span className="disp tnum text-[44px]">{num(avg.kcal)}</span>
              <span className="font-semibold text-muted">{T ? `kcal of your ${num(T.kcal)} daily target` : 'kcal (set a Fuel Log profile for targets)'}</span>
            </p>
            <div className="mt-4 flex flex-col gap-3.5">
              {(
                [
                  ['Protein', avg.p, T?.protein, 'coral'],
                  ['Carbs', avg.c, T?.carbs, 'sun'],
                  ['Fat', avg.f, T?.fat, 'violet']
                ] as const
              ).map(([label, v, t, tone]) => (
                <div key={label}>
                  <div className="flex justify-between text-[14px]">
                    <span className="font-bold">{label}</span>
                    <span className="tnum text-muted">
                      <b className="text-ink">{Math.round(v)}</b>
                      {t ? ` / ${t}` : ''} g
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <ProgressBar value={t ? v / t : 0} tone={tone} label={`${label} ${Math.round(v)} g`} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      <section>
        <SectionTitle>Cook plan</SectionTitle>
        {C.length === 0 ? (
          <Card className="text-[13px] text-muted">Nothing planned this week yet.</Card>
        ) : (
          <div className="rounded-card border border-line bg-surface">
            {C.map((c) => (
              <button
                key={`${c.slot}-${c.meal.id}`}
                type="button"
                onClick={() => setSlot({ date: c.dates[0], slot: c.slot, monday })}
                className="flex w-full items-center gap-3 border-line px-4 py-3 text-left [&+&]:border-t"
              >
                <span className="inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-ctl bg-sun-soft text-sun-ink">
                  <CookingPot size={18} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{c.meal.name}</span>
                  <span className="text-[13px] text-muted">
                    {c.dates.length > 1 ? 'Batch · ' : ''}
                    {c.dates.map((x) => fromISODate(x).toLocaleDateString('en-GB', { weekday: 'short' })).join(', ')} {c.slot}
                  </span>
                </span>
                <span className="tnum whitespace-nowrap font-extrabold">
                  {c.portions} portion{c.portions === 1 ? '' : 's'}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <SlotSheet slot={slot} onClose={() => setSlot(null)} />
    </>
  );
}
