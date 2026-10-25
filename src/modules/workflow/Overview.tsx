import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Users, Zap } from 'lucide-react';
import { Button, Card, Header, Notice, SectionTitle } from '@/components/ui';
import { todayISO } from '@/lib/date';
import BucketSheet from './BucketSheet';
import MilestoneSheet from './MilestoneSheet';
import { TaskRow } from './parts';
import PeopleSheet from './PeopleSheet';
import { bucketStats, dateCtx, overview, relDue } from './stats';
import { useWorkflow } from './store';
import type { BucketColor, Milestone } from './types';

type Filter = 'attention' | 'today' | 'late' | 'done';
const TITLES: Record<Filter, string> = {
  attention: 'Needs attention',
  today: 'Due today',
  late: 'Overdue',
  done: 'Recently completed'
};
const kcard: Record<BucketColor, string> = { coral: 'k-coral', violet: 'k-violet', sun: 'k-sun', green: 'k-green' };
const legendDot: Record<BucketColor, string> = { coral: 'bg-coral', violet: 'bg-violet-hi', sun: 'bg-sun', green: 'bg-green' };

export default function Overview() {
  const { buckets, projects, milestones, hasSample, clearSample, toggleMilestone } = useWorkflow();
  const today = todayISO();
  const c = dateCtx(today);
  const W = overview(projects, milestones, c);
  const [filter, setFilter] = useState<Filter>('attention');
  const [sheet, setSheet] = useState<'bucket' | 'people' | 'task' | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const list: Milestone[] =
    filter === 'today'
      ? W.dueToday
      : filter === 'late'
        ? W.overdue
        : filter === 'done'
          ? [...W.done].sort((a, b) => (b.done_at ?? '').localeCompare(a.done_at ?? '')).slice(0, 10)
          : W.attention;
  const projectOf = (m: Milestone) => projects.find((p) => p.id === m.project_id);
  const bucketOf = (m: Milestone) => buckets.find((b) => b.id === projectOf(m)?.bucket_id);
  const perBucket = buckets.map((b) => ({ b, s: bucketStats(b, projects, milestones) }));

  return (
    <>
      <Header
        label="Work"
        title="Workflow"
        right={
          <>
            <button type="button" onClick={() => setSheet('people')} className="inline-flex h-[38px] items-center gap-1.5 rounded-ctl border border-line bg-surface px-3 text-[13px] font-bold">
              <Users size={15} aria-hidden />
              People
            </button>
            <button type="button" onClick={() => setSheet('bucket')} className="inline-flex h-[38px] items-center gap-1.5 rounded-ctl border border-line bg-surface px-3 text-[13px] font-bold">
              <Plus size={14} strokeWidth={2.5} aria-hidden />
              Bucket
            </button>
          </>
        }
      />

      <Card dark className="!p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[14px] text-hero-muted">Active projects</p>
            <p className="disp tnum mt-1.5 text-[88px] !leading-[0.85] !tracking-[-0.04em] [text-shadow:var(--glow-violet)]">{W.activeProjects}</p>
            <p className="mt-2 text-[13px] text-hero-muted">{W.open} open milestones</p>
          </div>
          <div className="flex flex-col items-end gap-2 pt-1">
            <span className="inline-flex h-[30px] items-center gap-1.5 rounded-chip bg-rose px-3 text-[13px] font-extrabold text-surface">
              <Zap size={12} fill="currentColor" strokeWidth={0} aria-hidden />
              {W.p1Projects} × P1
            </span>
            <span className="inline-flex h-[30px] items-center rounded-chip bg-white/10 px-3 text-[13px]">{W.dueWeek} due this week</span>
          </div>
        </div>
        {W.open > 0 && (
          <div className="mt-5 flex gap-1" aria-hidden>
            {perBucket.map(({ b, s }) =>
              s.open ? <span key={b.id} className={`h-3 rounded-[6px] ${legendDot[b.color]}`} style={{ flex: s.open }} /> : null
            )}
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-hero-muted">
          {perBucket.map(({ b, s }) => (
            <span key={b.id} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${legendDot[b.color]}`} aria-hidden />
              {b.name} {s.open}
            </span>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-2.5">
        {(
          [
            ['today', W.dueToday.length, 'Due today', 'bg-sun-soft', 'text-sun-ink', 'text-ink'],
            ['late', W.overdue.length, 'Overdue', 'bg-rose-soft', 'text-rose-ink', 'text-rose-ink'],
            ['done', W.done.length, 'Completed', 'bg-green-soft', 'text-green-ink', 'text-green-ink']
          ] as const
        ).map(([f, n, label, bg, lbl, numCls]) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(filter === f ? 'attention' : f)}
            className={`rounded-[14px] px-3.5 py-4 text-left ${bg} ${filter === f ? 'outline outline-2 outline-offset-2 outline-ink' : ''}`}
          >
            <span className={`disp tnum block text-[40px] ${numCls}`}>{n}</span>
            <span className={`mt-2 block text-[13px] font-semibold ${lbl}`}>{label}</span>
          </button>
        ))}
      </div>

      {hasSample && (
        <Notice tone="sun">
          <span className="block">The projects, milestones and extra people are samples.</span>
          <button
            type="button"
            className="mt-1 font-bold underline"
            onClick={async () => {
              if (!confirmClear) return setConfirmClear(true);
              await clearSample();
              setConfirmClear(false);
            }}
          >
            {confirmClear ? 'Tap again to clear them' : 'Clear sample work'}
          </button>
        </Notice>
      )}

      <section>
        <SectionTitle>Your buckets</SectionTitle>
        <div className="flex flex-col gap-2.5">
          {perBucket.map(({ b, s }) => (
            <Link key={b.id} to={`/work/b/${b.id}`} className={`kcard ${kcard[b.color]} block rounded-card p-5`}>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-display text-[19px] font-bold">{b.name}</span>
                {s.p1 > 0 && (
                  <span className="inline-flex h-7 items-center gap-1 rounded-chip border border-line bg-surface px-2.5 text-[12px] font-extrabold text-rose">
                    <Zap size={11} fill="currentColor" strokeWidth={0} aria-hidden />
                    {s.p1} P1
                  </span>
                )}
              </div>
              <div className="mt-4 flex items-end gap-2">
                <span className="disp knum tnum text-[56px] !leading-[0.85]">{s.open}</span>
                <span className="pb-0.5 text-[14px] font-medium">
                  milestones left · {s.projects.length} {s.projects.length === 1 ? 'project' : 'projects'}
                </span>
              </div>
              <span className="ktrack mt-4 block h-2 overflow-hidden rounded-[4px]">
                <span className="kbar block h-full rounded-[4px]" style={{ width: `${Math.round(s.pct * 100)}%` }} />
              </span>
              <div className="mt-2 flex justify-between text-[13px] font-medium">
                <span>{Math.round(s.pct * 100)}% done</span>
                <span>{s.next ? `Next due ${relDue(s.next, today)}` : 'Nothing due'}</span>
              </div>
            </Link>
          ))}
          {buckets.length === 0 && <Card className="text-[13px] text-muted">Add a bucket to start grouping your work.</Card>}
        </div>
      </section>

      <section>
        <SectionTitle
          right={
            filter !== 'attention' ? (
              <button type="button" onClick={() => setFilter('attention')} className="font-bold text-ink underline">
                Show needs attention
              </button>
            ) : (
              'Late, due soon, P1'
            )
          }
        >
          {TITLES[filter]}
        </SectionTitle>
        {list.length ? (
          <div className="rounded-card border border-line bg-surface py-1">
            {list.map((m) => (
              <TaskRow key={m.id} m={m} project={projectOf(m)} bucket={bucketOf(m)} today={today} onToggle={() => void toggleMilestone(m.id)} />
            ))}
          </div>
        ) : (
          <Card className="text-[13px] text-muted">Nothing here.</Card>
        )}
      </section>

      <Button variant="violet" icon={Plus} onClick={() => setSheet('task')}>
        New task
      </Button>

      <BucketSheet open={sheet === 'bucket'} onClose={() => setSheet(null)} />
      <PeopleSheet open={sheet === 'people'} onClose={() => setSheet(null)} />
      <MilestoneSheet open={sheet === 'task'} onClose={() => setSheet(null)} />
    </>
  );
}
