import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Apple,
  BriefcaseBusiness,
  CalendarX,
  Check,
  ChevronRight,
  CookingPot,
  Dumbbell,
  Flame,
  Moon,
  Plus,
  Sun,
  Zap,
  type LucideIcon
} from 'lucide-react';
import { extraAreas } from '@/areas';
import { Card, Header, IconButton, ModuleCard, Page, SectionTitle } from '@/components/ui';
import { formatLong, fromISODate, greeting, todayISO } from '@/lib/date';
import { isDarkTheme, useSettings } from '@/lib/settings';
import { CalendarProvider } from '@/modules/calendar/store';
import UpNext from '@/modules/calendar/UpNext';
import FoodSheet, { type FoodDraft } from '@/modules/fuellog/FoodSheet';
import { FuelLogProvider, useFuelLog } from '@/modules/fuellog/store';
import type { Meal } from '@/modules/fuellog/types';
import { workoutVolume } from '@/modules/liftlog/stats';
import { LiftLogProvider, useLiftLog } from '@/modules/liftlog/store';
import WorkoutSheet, { emptyDraft, type Draft } from '@/modules/liftlog/WorkoutSheet';
import { mondayOf, shoppingList, weekPlan } from '@/modules/mealprep/plan';
import { MealPrepProvider, useMealPrep } from '@/modules/mealprep/store';
import { AISLES } from '@/modules/mealprep/types';
import { relDue } from '@/modules/workflow/stats';
import MilestoneSheet from '@/modules/workflow/MilestoneSheet';
import { WorkflowProvider, useWorkflow } from '@/modules/workflow/store';
import { STREAK_TARGET, glance, nudges, weekSummary, type HomeInput, type Nudge } from './home/summary';

// Home answers "what matters today?": a stat per module, quick actions,
// nudges when something needs doing, today's plan, and the weekly summary.
// It reads every module without adding any module's sample data.

export default function HomeScreen() {
  return (
    <LiftLogProvider seed={false}>
      <FuelLogProvider seed={false}>
        <WorkflowProvider seed={false}>
          <MealPrepProvider seed={false}>
            <CalendarProvider>
              <Home />
            </CalendarProvider>
          </MealPrepProvider>
        </WorkflowProvider>
      </FuelLogProvider>
    </LiftLogProvider>
  );
}

/** Mealtime for "now": breakfast before 11, lunch before 15, dinner before 21, else snacks. */
function mealNow(): Meal {
  const h = new Date().getHours();
  return h < 11 ? 'breakfast' : h < 15 ? 'lunch' : h < 21 ? 'dinner' : 'snacks';
}

const num = (n: number) => Math.round(n).toLocaleString('en-GB');
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const short = (iso: string) => fromISODate(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

function Home() {
  const { settings, update } = useSettings();
  const lift = useLiftLog();
  const fuel = useFuelLog();
  const work = useWorkflow();
  const meal = useMealPrep();
  const navigate = useNavigate();
  const [sheet, setSheet] = useState<'task' | null>(null);
  const [workout, setWorkout] = useState<Draft | null>(null);
  const [food, setFood] = useState<FoodDraft | null>(null);
  const now = new Date();
  const today = todayISO();
  const dark = isDarkTheme(settings.theme);
  const loading = lift.loading || fuel.loading || work.loading;

  const input = useMemo<HomeInput>(() => {
    const kcal = new Map<string, number>();
    for (const e of fuel.entries) kcal.set(e.date, (kcal.get(e.date) ?? 0) + e.kcal * e.servings);
    return {
      today,
      hour: new Date().getHours(),
      lift: {
        streak: lift.stats.streak,
        workouts: lift.workouts.map((w) => ({ id: w.id, date: w.date, volume: workoutVolume(w) })),
        prDates: lift.stats.prs.map((p) => p.date)
      },
      fuel: { target: (d) => fuel.targetsOn(d)?.kcal ?? null, kcal, weights: fuel.weights },
      work: { tasks: work.milestones, projects: work.projects }
    };
  }, [today, lift.stats, lift.workouts, fuel, work.milestones, work.projects]);

  const g = glance(input);
  const ns = settings.reminders.nudges ? nudges(input, (d) => relDue(d, today)) : [];
  const ws = weekSummary(input);

  const left = g.kcalTarget === null ? null : g.kcalTarget - g.kcalEaten;
  const monday = mondayOf(today);
  const week = weekPlan(meal.plan, monday);
  const list = shoppingList(week, meal.meals, meal.ingredients, meal.shopping, monday, AISLES.map((a) => a.id));
  const allTasks = work.milestones.filter((m) => work.projects.some((p) => p.id === m.project_id));
  const activeProjects = work.projects.filter((p) => p.status !== 'Done');
  const v = (s: string | number) => (loading ? '–' : s);

  function act(n: Nudge) {
    if (n.kind === 'workout') setWorkout(emptyDraft());
    else if (n.kind === 'food') setFood({ date: today, meal: mealNow() });
    else if (n.kind === 'p1') navigate(`/work/p/${n.projectId}`);
    else navigate('/work');
  }

  return (
    <Page>
      <Header
        label={formatLong(now)}
        title={`${greeting(now)}${settings.name ? `, ${settings.name}` : ''}`}
        right={
          <IconButton
            icon={dark ? Sun : Moon}
            label={`Switch to ${dark ? 'light' : 'dark'} theme`}
            onClick={() => void update({ theme: dark ? 'light' : 'dark' })}
          />
        }
      />

      <Card dark className="!p-5">
        <p className="text-[14px] text-hero-muted">Today at a glance</p>
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          <GlanceStat
            to="/health?m=lift"
            value={v(g.streak)}
            label="week lift streak"
            sub={loading ? undefined : g.trainedToday ? 'Trained today' : 'Not trained today'}
            className="text-coral [text-shadow:var(--glow-coral)]"
          />
          <GlanceStat
            to="/health?m=fuel"
            value={loading || left === null ? '–' : num(Math.abs(left))}
            label={left !== null && left < 0 ? 'kcal over today' : 'kcal left today'}
            sub={!loading && left === null ? 'Set up targets' : undefined}
            className={left !== null && left < 0 ? 'text-rose' : 'text-green-hi [text-shadow:var(--glow-green)]'}
          />
          <GlanceStat to="/work" value={v(g.p1Week)} label="P1 due this week" className="text-violet-hi [text-shadow:var(--glow-violet)]" />
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2">
          <Quick icon={Plus} onClick={() => setWorkout(emptyDraft())}>
            Workout
          </Quick>
          <Quick icon={Plus} onClick={() => setFood({ date: today, meal: mealNow() })}>
            Food
          </Quick>
          <Quick icon={Plus} onClick={() => setSheet('task')}>
            Task
          </Quick>
        </div>
      </Card>

      {settings.reminders.nudges && !loading && (
        <section>
          <SectionTitle>Nudges</SectionTitle>
          <div className="flex flex-col gap-2">
            {ns.length === 0 ? (
              <NudgeCard tone="green" icon={Check} title="All clear" sub="Nothing needs your attention right now" />
            ) : (
              ns.map((n) => (
                <NudgeCard
                  key={n.kind}
                  tone={n.tone}
                  icon={{ workout: Flame, p1: Zap, overdue: CalendarX, food: Apple }[n.kind]}
                  title={n.title}
                  sub={n.sub}
                  onClick={() => act(n)}
                />
              ))
            )}
          </div>
        </section>
      )}

      <Link to="/faith" className="flex items-center gap-3 rounded-card border border-gold bg-faith p-4 text-niche">
        <Moon size={20} className="text-gold-hi" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block font-bold">Faith</span>
          <span className="block text-[13px] opacity-80">Next prayer and today's on-time count arrive in step 7</span>
        </span>
        <ChevronRight size={18} aria-hidden />
      </Link>

      <UpNext />

      <section>
        <SectionTitle>Your areas</SectionTitle>
        <div className="grid grid-cols-2 gap-2.5">
          <ModuleCard
            to="/health?m=lift"
            tone="coral"
            icon={Dumbbell}
            title="Lift Log"
            value={v(g.streak)}
            unit={g.streak === 1 ? 'week' : 'weeks'}
            progress={Math.min(g.thisWeek, STREAK_TARGET) / STREAK_TARGET}
            caption={`${Math.min(g.thisWeek, STREAK_TARGET)} of ${STREAK_TARGET} this week`}
          />
          <ModuleCard
            to="/health?m=fuel"
            tone="green"
            icon={Apple}
            title="Fuel Log"
            value={loading || left === null ? '–' : num(Math.abs(left))}
            unit={left !== null && left < 0 ? 'kcal over' : 'kcal left'}
            progress={g.kcalTarget ? g.kcalEaten / g.kcalTarget : 0}
            caption={g.kcalTarget === null ? 'Set up your targets' : `${num(g.kcalEaten)} of ${num(g.kcalTarget)} eaten`}
          />
          <ModuleCard
            to="/health?m=meal"
            tone="sun"
            icon={CookingPot}
            title="Meal Prep"
            value={meal.loading ? '–' : week.length}
            unit="of 21"
            progress={week.length / 21}
            caption={`${plural(list.total - list.done, 'item')} to buy`}
          />
          <ModuleCard
            to="/work"
            tone="violet"
            icon={BriefcaseBusiness}
            title="Workflow"
            value={v(g.open)}
            unit="open"
            progress={allTasks.length ? (allTasks.length - g.open) / allTasks.length : 0}
            caption={`${activeProjects.filter((p) => p.priority === 'P1').length} × P1 · ${plural(activeProjects.length, 'project')}`}
          />
        </div>
      </section>

      {!loading && (
        <Card>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="font-display text-[18px] font-bold tracking-[-0.015em]">{ws.current ? 'This week' : 'Last week'}</h2>
            <span className="text-[13px] text-muted">
              {short(ws.start)} to {short(ws.end)}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-4">
            <SumTile to="/health?m=lift" value={ws.workouts} className="text-coral-ink">
              {plural(ws.workouts, 'workout')} · {num(ws.volume)} kg · {plural(ws.prs, 'new PR')}
            </SumTile>
            <SumTile to="/health?m=fuel" value={`${ws.onTarget}/7`} className="text-green-ink">
              days on calorie target{ws.logged > ws.onTarget ? ` · ${ws.logged} logged` : ''}
            </SumTile>
            <SumTile to="/work" value={ws.done} className="text-violet-ink">
              {ws.done === 1 ? 'task' : 'tasks'} completed · {ws.open} still open
            </SumTile>
            <SumTile
              to="/health?m=fuel"
              value={ws.weightChange === null ? '–' : `${ws.weightChange > 0 ? '+' : ws.weightChange < 0 ? '−' : ''}${Math.abs(ws.weightChange).toFixed(1)}`}
            >
              kg body weight
            </SumTile>
          </div>
          {ws.nextBig && (
            <Link to={`/work/p/${ws.nextBig.projectId}`} className="mt-4 flex items-center gap-3 rounded-btn bg-bg px-3.5 py-3">
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-semibold text-muted">Biggest item {ws.current ? 'next' : 'this'} week</span>
                <span className="block truncate font-bold">{ws.nextBig.title}</span>
                <span className="block truncate text-[13px] text-muted">
                  {ws.nextBig.priority} · {ws.nextBig.project} · {relDue(ws.nextBig.due, today)}
                </span>
              </span>
              <ChevronRight size={18} aria-hidden />
            </Link>
          )}
        </Card>
      )}

      <section>
        <SectionTitle>Coming next</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {extraAreas.map((a) => (
            <Link
              key={a.id}
              to={a.path}
              className="inline-flex h-[38px] items-center gap-1.5 rounded-ctl border-[1.5px] border-line2 px-4 text-[14px] font-semibold"
            >
              <a.icon size={14} aria-hidden />
              {a.label}
            </Link>
          ))}
          {['Finance', 'Learning', 'Personal']
            .filter((name) => !extraAreas.some((a) => a.label === name))
            .map((name) => (
              <span
                key={name}
                className="inline-flex h-[38px] items-center gap-1.5 rounded-ctl border-[1.5px] border-dashed border-line2 px-4 text-[14px] font-semibold text-muted"
              >
                <Plus size={14} aria-hidden />
                {name}
              </span>
            ))}
        </div>
      </section>

      <WorkoutSheet draft={workout} onClose={() => setWorkout(null)} />
      {food && <FoodSheet draft={food} onClose={() => setFood(null)} />}
      <MilestoneSheet open={sheet === 'task'} onClose={() => setSheet(null)} />
    </Page>
  );
}

function GlanceStat({ to, value, label, sub, className }: { to: string; value: ReactNode; label: string; sub?: string; className: string }) {
  return (
    <Link to={to} className="min-w-0 text-left [&+&]:border-l [&+&]:border-white/10 [&+&]:pl-3">
      <span className={`disp tnum block text-[40px] ${className}`}>{value}</span>
      <span className="mt-2 block text-[13px] text-hero-muted">{label}</span>
      {sub && <span className="mt-0.5 block text-[12px] font-semibold text-white/80">{sub}</span>}
    </Link>
  );
}

function Quick({ icon: Icon, onClick, children }: { icon: LucideIcon; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-ctl border border-hero-line bg-white/10 text-[13px] font-bold text-white"
    >
      <Icon size={16} strokeWidth={2.5} aria-hidden />
      {children}
    </button>
  );
}

const NUDGE = {
  sun: { card: 'bg-sun-soft text-sun-ink', icon: 'bg-sun text-white' },
  rose: { card: 'bg-rose-soft text-rose-ink', icon: 'bg-rose text-white' },
  green: { card: 'bg-green-soft text-green-ink', icon: 'bg-green text-white' }
};

function NudgeCard({ tone, icon: Icon, title, sub, onClick }: { tone: keyof typeof NUDGE; icon: LucideIcon; title: string; sub: string; onClick?: () => void }) {
  const inner = (
    <>
      <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-ctl ${NUDGE[tone].icon}`}>
        <Icon size={20} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold text-ink">{title}</span>
        <span className="mt-0.5 block text-[13px]">{sub}</span>
      </span>
      {onClick && <ChevronRight size={18} aria-hidden />}
    </>
  );
  const cls = `flex w-full items-center gap-3 rounded-[14px] px-4 py-3.5 text-left ${NUDGE[tone].card}`;
  return onClick ? (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

function SumTile({ to, value, className = '', children }: { to: string; value: ReactNode; className?: string; children: ReactNode }) {
  return (
    <Link to={to} className="min-w-0">
      <span className={`disp tnum block text-[34px] leading-none ${className}`}>{value}</span>
      <span className="mt-1.5 block text-[13px] text-muted">{children}</span>
    </Link>
  );
}
