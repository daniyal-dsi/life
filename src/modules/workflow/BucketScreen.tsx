import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Pencil, Plus } from 'lucide-react';
import { Badge, Button, Card, Header } from '@/components/ui';
import { todayISO } from '@/lib/date';
import BucketSheet from './BucketSheet';
import { Avatars, BackLink, StatusBadge, stripe } from './parts';
import ProjectSheet from './ProjectSheet';
import { bucketStats, projectStats, relDue } from './stats';
import { useWorkflow } from './store';
import { PRIORITIES } from './types';

type Filter = 'all' | 'P1' | 'In progress' | 'Done';
const FILTERS: Filter[] = ['all', 'P1', 'In progress', 'Done'];

export default function BucketScreen() {
  const { id } = useParams();
  const { buckets, projects, milestones, people } = useWorkflow();
  const [filter, setFilter] = useState<Filter>('all');
  const [sheet, setSheet] = useState<'edit' | 'project' | null>(null);
  const today = todayISO();
  const b = buckets.find((x) => x.id === id);
  if (!b) return <Navigate to="/work" replace />;
  const s = bucketStats(b, projects, milestones);
  const list = s.projects
    .filter((p) => filter === 'all' || (filter === 'P1' ? p.priority === 'P1' : p.status === filter))
    .sort((x, y) => PRIORITIES.indexOf(x.priority) - PRIORITIES.indexOf(y.priority) || (x.due ?? 'z').localeCompare(y.due ?? 'z'));

  return (
    <>
      <div className="pt-4">
        <BackLink to="/work" label="Workflow" />
      </div>
      <Header
        label="Bucket"
        title={b.name}
        right={
          <button type="button" onClick={() => setSheet('edit')} className="inline-flex h-[38px] items-center gap-1.5 rounded-ctl border border-line bg-surface px-3 text-[13px] font-bold">
            <Pencil size={15} aria-hidden />
            Edit
          </button>
        }
      />
      <div className="-mt-4 grid grid-cols-3 gap-2.5">
        {(
          [
            [s.projects.length, 'Projects', 'bg-chip', 'text-muted'],
            [s.open, 'Steps left', 'bg-violet-soft', 'text-violet-ink'],
            [`${Math.round(s.pct * 100)}%`, 'Done', 'bg-green-soft', 'text-green-ink']
          ] as const
        ).map(([n, label, bg, lbl]) => (
          <div key={label} className={`rounded-[14px] px-3.5 py-4 ${bg}`}>
            <span className="disp tnum block text-[36px]">{n}</span>
            <span className={`mt-2 block text-[13px] font-semibold ${lbl}`}>{label}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={`h-9 rounded-ctl border px-3.5 text-[14px] font-semibold ${filter === f ? 'border-btn bg-btn text-btn-text' : 'border-line2 bg-surface'}`}
          >
            {f === 'all' ? 'All' : f}
          </button>
        ))}
      </div>

      <section className="flex flex-col gap-2.5">
        {list.length === 0 && (
          <Card className="text-[13px] text-muted">{s.projects.length ? 'No projects match this filter.' : 'No projects yet. Add the first one below.'}</Card>
        )}
        {list.map((p) => {
          const q = projectStats(p, milestones);
          return (
            <Link key={p.id} to={`/work/p/${p.id}`} className="flex flex-col gap-2.5 rounded-card border border-line bg-surface p-4">
              <span className="flex flex-wrap items-center gap-2">
                <Badge kind={p.priority} />
                <StatusBadge status={p.status} />
                {p.due && <span className="ml-auto text-[13px] text-muted">Due {relDue(p.due, today)}</span>}
              </span>
              <span className="font-display text-[19px] font-bold">{p.name}</span>
              <span className="flex items-center gap-2.5">
                <span className="h-2 flex-1 overflow-hidden rounded-[4px] bg-chip">
                  <span className={`block h-full rounded-[4px] ${stripe[b.color]}`} style={{ width: `${Math.round(q.pct * 100)}%` }} />
                </span>
                <span className="tnum text-[13px] font-bold">
                  {q.done}/{q.total}
                </span>
              </span>
              <span className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-[13px] text-muted">{q.next ? `Next: ${q.next.title}` : q.total ? 'All steps done' : 'No milestones yet'}</span>
                <Avatars ids={p.people} people={people} />
              </span>
            </Link>
          );
        })}
      </section>

      <Button variant="violet" icon={Plus} onClick={() => setSheet('project')}>
        Add project to {b.name}
      </Button>

      <BucketSheet bucket={b} open={sheet === 'edit'} onClose={() => setSheet(null)} />
      <ProjectSheet bucketId={b.id} open={sheet === 'project'} onClose={() => setSheet(null)} />
    </>
  );
}
