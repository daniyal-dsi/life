import { Check, ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui';
import { doneLabel, dueState, relDue } from './stats';
import type { Bucket, BucketColor, Milestone, Person, Project, Status } from './types';

// Small pieces shared by the Workflow screens.

export const stripe: Record<BucketColor, string> = {
  coral: 'bg-coral',
  violet: 'bg-violet',
  sun: 'bg-sun',
  green: 'bg-green'
};

const statusStyle: Record<Status, string> = {
  Planning: 'bg-chip text-muted',
  'In progress': 'bg-violet-soft text-violet-ink',
  Blocked: 'bg-rose-soft text-rose-ink',
  Done: 'bg-green-soft text-green-ink'
};

export function StatusBadge({ status }: { status: Status }) {
  return <span className={`rounded-[6px] px-2 py-[3px] text-[12px] font-bold ${statusStyle[status]}`}>{status}</span>;
}

export function Avatars({ ids, people, max = 4 }: { ids: string[]; people: Person[]; max?: number }) {
  const list = ids.map((id) => people.find((p) => p.id === id)).filter((p): p is Person => !!p);
  return (
    <span className="flex">
      {list.slice(0, max).map((p, i) => (
        <span
          key={p.id}
          title={p.name}
          className={`inline-flex h-[30px] w-[30px] items-center justify-center rounded-full border-2 border-surface bg-chip text-[11px] font-extrabold text-ink ${i ? '-ml-2' : ''}`}
        >
          {p.initials}
        </span>
      ))}
      {list.length > max && <span className="ml-1 self-center text-[12px] text-muted">+{list.length - max}</span>}
    </span>
  );
}

export function DuePill({ m, today }: { m: { due: string | null; done: boolean; done_at?: string | null }; today: string }) {
  const s = dueState(m, today);
  return (
    <span
      className={`whitespace-nowrap rounded-chip px-2.5 py-1.5 text-[13px] font-bold ${
        s === 'late' ? 'bg-rose-soft text-rose-ink' : s === 'today' ? 'bg-sun-soft text-sun-ink' : 'bg-chip'
      }`}
    >
      {m.done ? doneLabel(m.done_at ?? null, today) : relDue(m.due, today)}
    </span>
  );
}

export function CheckButton({ done, title, onToggle }: { done: boolean; title: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={done}
      aria-label={`${done ? 'Mark not done' : 'Mark done'}: ${title}`}
      onClick={onToggle}
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-chip border-2 ${
        done ? 'border-green bg-green text-hero' : 'border-line2 text-transparent'
      }`}
    >
      <Check size={16} strokeWidth={3} aria-hidden />
    </button>
  );
}

/** A milestone in a cross-project list (overview), linking to its project. */
export function TaskRow({
  m,
  project,
  bucket,
  today,
  onToggle
}: {
  m: Milestone;
  project?: Project;
  bucket?: Bucket;
  today: string;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 [&+&]:border-t [&+&]:border-line">
      <CheckButton done={m.done} title={m.title} onToggle={onToggle} />
      <Link to={project ? `/work/p/${project.id}` : '/work'} className="flex min-w-0 flex-1 items-center gap-2.5">
        <span className={`w-[3px] self-stretch rounded-sm ${bucket ? stripe[bucket.color] : 'bg-line2'}`} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className={`block text-[15px] font-semibold ${m.done ? 'text-muted line-through' : ''}`}>{m.title}</span>
          <span className="mt-1 flex items-center gap-1.5">
            <Badge kind={project?.priority ?? 'P3'} />
            <span className="min-w-0 truncate text-[13px] text-muted">
              {project?.name ?? 'Removed project'}
              {bucket ? ` · ${bucket.name}` : ''}
            </span>
          </span>
        </span>
        <DuePill m={m} today={today} />
      </Link>
    </div>
  );
}

export function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="inline-flex h-[38px] items-center gap-1.5 self-start rounded-ctl border border-line bg-surface px-3.5 text-[13px] font-bold"
    >
      <ChevronLeft size={16} strokeWidth={2.5} aria-hidden />
      {label}
    </Link>
  );
}
