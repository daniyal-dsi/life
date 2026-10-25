import { useMemo, useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp, ClipboardList, Pencil, Plus } from 'lucide-react';
import { Donut, LineChart } from '@/components/charts';
import { Badge, Button, Card, Notice, SectionTitle } from '@/components/ui';
import { addDays, fromISODate, todayISO, toISODate } from '@/lib/date';
import ExercisesSheet from './ExercisesSheet';
import { dayLabel, k1, kg, monthName, num, plural, shortDate } from './format';
import { STREAK_TARGET, topSetIndex, workoutTitle, workoutVolume } from './stats';
import { LiftLogProvider, useLiftLog } from './store';
import TemplatesSheet from './TemplatesSheet';
import { GROUP_LABEL, GROUPS, type MuscleGroup, type Workout } from './types';
import WorkoutSheet, { draftFromTemplate, draftFromWorkout, emptyDraft, type Draft } from './WorkoutSheet';

// Donut ring order and colours, validated for colour-blind separation.
const RING: MuscleGroup[] = ['chest', 'back', 'shoulders', 'legs', 'arms', 'core'];

export default function LiftLog() {
  return (
    <LiftLogProvider>
      <Dashboard />
    </LiftLogProvider>
  );
}

function Dashboard() {
  const { loading, error, stats, exercises, templates, hasSample, clearSample } = useLiftLog();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [sheet, setSheet] = useState<'exercises' | 'templates' | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [chartEx, setChartEx] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const today = todayISO();

  const exName = (id: string) => exercises.find((e) => e.id === id)?.name ?? 'Removed exercise';
  const title = (w: Workout) =>
    templates.find((t) => t.id === w.template_id)?.name ?? workoutTitle(w, exercises, GROUP_LABEL);
  const toggle = (id: string) =>
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const open = (id: string) => {
    setExpanded((s) => new Set(s).add(id));
    requestAnimationFrame(() => document.getElementById(`w-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const withData = exercises.filter((e) => stats.best[e.id]);
  const chartId =
    chartEx && stats.best[chartEx] ? chartEx : (withData.find((e) => e.name === 'Bench press') ?? withData[0])?.id ?? null;
  const points = useMemo(() => {
    if (!chartId) return [];
    const pts: { label: string; value: number; highlight: boolean }[] = [];
    for (const w of stats.workouts) {
      for (const en of w.entries) {
        if (en.exercise_id !== chartId) continue;
        const mi = topSetIndex(en.sets);
        if (mi < 0) continue;
        pts.push({ label: shortDate(w.date), value: en.sets[mi].w, highlight: stats.prSets.has(`${w.id}|${en.exercise_id}|${mi}`) });
      }
    }
    return pts.slice(-10);
  }, [chartId, stats]);

  if (loading) return <p className="py-10 text-center text-muted">Loading Lift Log…</p>;
  if (error) return <Notice tone="rose">{error}</Notice>;

  const weekEnd = toISODate(addDays(fromISODate(stats.weekStart), 6));
  const slots = Math.max(STREAK_TARGET, stats.thisWeek.length);
  const recentPRs = [...stats.prs].reverse().slice(0, 3);
  const newCutoff = toISODate(addDays(fromISODate(today), -14));
  const newPR = new Set(stats.prs.filter((p) => p.date >= newCutoff).map((p) => p.exerciseId));
  const gain = points.length > 1 ? points[points.length - 1].value - points[0].value : 0;

  return (
    <>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setSheet('templates')}
          className="inline-flex h-[38px] items-center gap-1.5 rounded-ctl border border-line bg-surface px-3.5 text-[13px] font-bold"
        >
          <ClipboardList size={16} aria-hidden />
          Templates
        </button>
        <button
          type="button"
          onClick={() => setSheet('exercises')}
          className="inline-flex h-[38px] items-center gap-1.5 rounded-ctl border border-line bg-surface px-3.5 text-[13px] font-bold"
        >
          <BookOpen size={16} aria-hidden />
          Exercises
        </button>
      </div>

      {/* Streak hero */}
      <section className="kcard k-coral rounded-hero p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[14px] font-semibold">Weekly streak</p>
            <div className="mt-1.5 flex items-end gap-2">
              <span className="disp knum tnum text-[96px] !leading-[0.85] !tracking-[-0.05em]">{stats.streak}</span>
              <span className="pb-1 text-[16px] font-semibold">{stats.streak === 1 ? 'week' : 'weeks'}</span>
            </div>
          </div>
          <span className="kicon inline-flex h-[30px] items-center rounded-chip px-3 text-[13px] font-extrabold">
            Best {stats.bestStreak}
          </span>
        </div>
        <p className="mt-4 text-[14px] font-semibold">
          This week · {shortDate(stats.weekStart)} to {shortDate(weekEnd)} · {STREAK_TARGET} workouts keeps it going
        </p>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {Array.from({ length: slots }, (_, i) => {
            const w = stats.thisWeek[i];
            return w ? (
              <button
                key={w.id}
                type="button"
                onClick={() => open(w.id)}
                className="kslot h-11 truncate rounded-btn px-1 text-[13px] font-bold"
              >
                {fromISODate(w.date).toLocaleDateString('en-GB', { weekday: 'short' })} · {title(w)}
              </button>
            ) : (
              <button
                key={`empty-${i}`}
                type="button"
                onClick={() => setDraft(emptyDraft())}
                className="kslot-empty inline-flex h-11 items-center justify-center gap-1 rounded-btn text-[13px] font-bold"
              >
                <Plus size={14} strokeWidth={2.5} aria-hidden />
                Log
              </button>
            );
          })}
        </div>
      </section>

      <Button variant="coral" icon={Plus} onClick={() => setDraft(emptyDraft())}>
        Log workout
      </Button>

      {hasSample && (
        <Notice tone="sun">
          <span className="block">These are sample workouts so the charts have something to show.</span>
          <button
            type="button"
            className="mt-1 font-bold underline"
            onClick={async () => {
              if (!confirmClear) return setConfirmClear(true);
              await clearSample();
              setConfirmClear(false);
            }}
          >
            {confirmClear ? 'Tap again to clear them' : 'Clear sample workouts'}
          </button>
        </Notice>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        <Card className="!p-3.5">
          <p className="text-[13px] text-muted">Workouts in {monthName(today)}</p>
          <p className="disp tnum mt-2.5 text-[44px]">{stats.month.length}</p>
        </Card>
        <Card className="!p-3.5">
          <p className="text-[13px] text-muted">Volume this week</p>
          <p className="mt-2.5 flex items-baseline gap-1">
            <span className="disp tnum text-[44px]">{k1(stats.weekVolume)}</span>
            <span className="font-semibold text-muted">kg</span>
          </p>
        </Card>
      </div>

      <section>
        <SectionTitle>Recent PRs</SectionTitle>
        {recentPRs.length === 0 ? (
          <Card className="text-[13px] text-muted">Beat your best weight on any exercise and it will show up here.</Card>
        ) : (
          <div className="flex flex-col gap-2">
            {recentPRs.map((p) => (
              <button
                key={`${p.workoutId}-${p.exerciseId}`}
                type="button"
                onClick={() => open(p.workoutId)}
                className="flex w-full items-center gap-3 rounded-[14px] bg-sun-soft px-4 py-3.5 text-left"
              >
                <Badge kind="PR" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-bold">
                    {exName(p.exerciseId)} · {kg(p.w)} kg × {p.r}
                  </span>
                  <span className="block text-[13px] text-sun-ink">
                    {dayLabel(p.date)} · +{kg(p.w - p.prev)} kg on previous best
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-[18px] font-bold">Progression</h2>
          {withData.length > 0 && (
            <select
              aria-label="Exercise to chart"
              value={chartId ?? ''}
              onChange={(e) => setChartEx(e.target.value)}
              className="h-[38px] max-w-[190px] rounded-ctl border border-line bg-surface px-2.5 text-[13px] font-bold"
            >
              {withData.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          )}
        </div>
        {points.length > 0 && (
          <div className="mt-3 flex flex-wrap items-baseline gap-2">
            <span className="disp tnum text-[34px]">{kg(points[points.length - 1].value)} kg</span>
            <span className={`text-[13px] font-bold ${gain >= 0 ? 'text-green-ink' : 'text-rose-ink'}`}>
              {gain >= 0 ? '+' : '−'}
              {kg(Math.abs(gain))} kg over {plural(points.length, 'session')}
            </span>
          </div>
        )}
        <div className="mt-3">
          <LineChart
            points={points}
            color="rgb(var(--coral))"
            area="rgb(var(--coral-soft))"
            label="Top set weight over time"
            format={(v) => `${kg(v)} kg`}
            empty="Log this exercise to see your progression."
          />
        </div>
      </Card>

      <Card>
        <h2 className="font-display text-[18px] font-bold">{monthName(today)} volume by muscle</h2>
        {stats.monthVolume === 0 ? (
          <p className="py-5 text-[13px] text-muted">No workouts logged this month yet.</p>
        ) : (
          <div className="mt-3.5">
            <Donut
              label={`Training volume by muscle group in ${monthName(today)}`}
              total={stats.monthVolume}
              centre={k1(stats.monthVolume)}
              centreUnit="kg lifted"
              format={(v) => `${k1(v)} kg`}
              slices={RING.map((g) => ({
                key: g,
                label: GROUP_LABEL[g],
                value: stats.volumeByGroup[g] ?? 0,
                color: `rgb(var(--g-${g}))`
              }))}
            />
          </div>
        )}
      </Card>

      <section>
        <SectionTitle right={`${withData.length} of ${exercises.length} exercises`}>Personal records</SectionTitle>
        {withData.length === 0 ? (
          <Card className="text-[13px] text-muted">Your best lift for each exercise appears here.</Card>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {GROUPS.flatMap((g) =>
              exercises
                .filter((e) => e.group === g.id && stats.best[e.id])
                .map((e) => {
                  const b = stats.best[e.id];
                  const isNew = newPR.has(e.id);
                  return (
                    <div
                      key={e.id}
                      className={`rounded-card p-3.5 ${isNew ? 'bg-sun-soft' : 'border border-line bg-surface'}`}
                    >
                      <p className={`text-[13px] ${isNew ? 'font-bold text-sun-ink' : 'text-muted'}`}>
                        {e.name}
                        {isNew ? ' · new' : ''}
                      </p>
                      <p className="disp tnum mt-1 text-[24px]">{kg(b.w)} kg</p>
                      <p className="mt-0.5 text-[13px] text-muted">
                        × {b.r} · {shortDate(b.date)}
                      </p>
                    </div>
                  );
                })
            )}
          </div>
        )}
      </section>

      <section>
        <SectionTitle>History</SectionTitle>
        {stats.workouts.length === 0 ? (
          <Card className="text-[13px] text-muted">No workouts yet. Log your first one above.</Card>
        ) : (
          <div className="flex flex-col gap-2.5">
            {[...stats.workouts].reverse().map((w) => {
              const isOpen = expanded.has(w.id);
              const hasPR = w.entries.some((en) => en.sets.some((_, i) => stats.prSets.has(`${w.id}|${en.exercise_id}|${i}`)));
              return (
                <div key={w.id} id={`w-${w.id}`} className="scroll-mt-4 overflow-hidden rounded-card border border-line bg-surface">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => toggle(w.id)}
                    className="flex w-full items-center justify-between gap-2.5 p-4 text-left"
                  >
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-[16px] font-bold">
                          {dayLabel(w.date)} · {title(w)}
                        </span>
                        {hasPR && (
                          <span className="rounded-[5px] bg-sun px-1.5 py-0.5 text-[11px] font-extrabold text-hero">PR</span>
                        )}
                        {w.sample && <span className="text-[12px] text-muted">sample</span>}
                      </span>
                      <span className="mt-0.5 block text-[13px] text-muted">
                        {plural(w.entries.length, 'exercise')} · {num(workoutVolume(w))} kg
                      </span>
                    </span>
                    {isOpen ? <ChevronUp size={18} aria-hidden /> : <ChevronDown size={18} aria-hidden />}
                  </button>
                  {isOpen && (
                    <div className="flex flex-col gap-2.5 border-t border-line px-4 pb-4 pt-3">
                      {w.entries.map((en, ei) => (
                        <div key={ei}>
                          <p className="text-[14px] font-bold">{exName(en.exercise_id)}</p>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {en.sets.map((s, i) => {
                              const pr = stats.prSets.has(`${w.id}|${en.exercise_id}|${i}`);
                              return (
                                <span
                                  key={i}
                                  className={`tnum inline-flex h-[34px] items-center gap-1.5 rounded-chip px-3 text-[13px] ${
                                    pr ? 'bg-sun pr-1.5 font-extrabold text-hero shadow-[var(--glow-sun)]' : 'bg-chip font-semibold'
                                  }`}
                                >
                                  {kg(s.w)} × {s.r}
                                  {pr && <b className="rounded-[6px] bg-hero px-1.5 py-0.5 text-[11px] text-sun">PR</b>}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                      {w.note && <p className="text-[13px] italic text-muted">{w.note}</p>}
                      <button
                        type="button"
                        onClick={() => setDraft(draftFromWorkout(w))}
                        className="mt-1 inline-flex h-[38px] items-center gap-1.5 self-start rounded-ctl border border-line px-3.5 text-[13px] font-bold"
                      >
                        <Pencil size={15} aria-hidden />
                        Edit or delete
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <WorkoutSheet draft={draft} onClose={() => setDraft(null)} />
      <ExercisesSheet open={sheet === 'exercises'} onClose={() => setSheet(null)} />
      <TemplatesSheet
        open={sheet === 'templates'}
        onClose={() => setSheet(null)}
        onStart={(t) => setDraft(draftFromTemplate(t, stats.workouts))}
      />
    </>
  );
}
