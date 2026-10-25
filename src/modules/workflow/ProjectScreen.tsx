import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { GripVertical, Pencil, Plus } from 'lucide-react';
import { SortableList } from '@/components/Sortable';
import { Badge, Button, Card, Field, Notice, SectionTitle, inputClass } from '@/components/ui';
import { fromISODate, todayISO } from '@/lib/date';
import MilestoneSheet from './MilestoneSheet';
import { Avatars, BackLink, CheckButton, StatusBadge } from './parts';
import ProjectSheet from './ProjectSheet';
import { doneLabel, dueState, projectStats, relDue } from './stats';
import { useWorkflow } from './store';
import type { BucketColor, Milestone } from './types';

const kcard: Record<BucketColor, string> = { coral: 'k-coral', violet: 'k-violet', sun: 'k-sun', green: 'k-green' };

export default function ProjectScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { projects, buckets, milestones, people, me, toggleMilestone, reorderMilestones, saveMilestone } = useWorkflow();
  const [sheet, setSheet] = useState<'edit' | null>(null);
  const [editing, setEditing] = useState<Milestone | null>(null);
  const [form, setForm] = useState({ title: '', owner: '', due: '' });
  const [error, setError] = useState<string | null>(null);
  const today = todayISO();
  const p = projects.find((x) => x.id === id);
  if (!p) return <Navigate to="/work" replace />;
  const b = buckets.find((x) => x.id === p.bucket_id);
  const q = projectStats(p, milestones);
  const owner = (oid: string | null) => {
    const o = people.find((x) => x.id === oid);
    return o ? `${o.name}${o.me ? ' (you)' : ''}` : 'Unassigned';
  };

  async function add(e: FormEvent) {
    e.preventDefault();
    const title = form.title.trim();
    if (!title) return setError('Say what needs doing.');
    try {
      await saveMilestone({
        project_id: p!.id,
        title,
        owner_id: (form.owner || me?.id) ?? null,
        due: form.due || null,
        done: false,
        done_at: null,
        order: q.ms.length
      });
      setForm({ title: '', owner: form.owner, due: '' });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the milestone.');
    }
  }

  return (
    <>
      <div className="pt-4">
        <BackLink to={b ? `/work/b/${b.id}` : '/work'} label={b?.name ?? 'Workflow'} />
      </div>
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge kind={p.priority} />
          <StatusBadge status={p.status} />
          {p.due && (
            <span className="text-[13px] text-muted">
              Due {fromISODate(p.due).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
            </span>
          )}
        </div>
        <div className="flex items-start justify-between gap-3">
          <h1 className="disp text-balance text-[30px] !leading-[1.05]">{p.name}</h1>
          <button type="button" onClick={() => setSheet('edit')} className="inline-flex h-[38px] shrink-0 items-center gap-1.5 rounded-ctl border border-line bg-surface px-3 text-[13px] font-bold">
            <Pencil size={15} aria-hidden />
            Edit
          </button>
        </div>
        {p.description && <p className="text-muted">{p.description}</p>}
      </header>

      <section className={`kcard ${kcard[b?.color ?? 'violet']} rounded-card p-5`}>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[14px] font-semibold">Progress</p>
            <p className="disp knum tnum mt-1.5 text-[60px] !leading-[0.85]">{Math.round(q.pct * 100)}%</p>
          </div>
          <div className="text-right font-semibold">
            {q.done} of {q.total} {q.total === 1 ? 'step' : 'steps'}
            <div className="mt-1.5 flex justify-end">
              <Avatars ids={p.people} people={people} />
            </div>
          </div>
        </div>
        <span className="ktrack mt-4 block h-2 overflow-hidden rounded-[4px]">
          <span className="kbar block h-full rounded-[4px]" style={{ width: `${Math.round(q.pct * 100)}%` }} />
        </span>
      </section>

      <section>
        <SectionTitle right={q.ms.length > 1 ? 'Drag the handle to reorder' : undefined}>Milestones</SectionTitle>
        <div className="rounded-card border border-line bg-surface py-1 [&_[role=listitem]+[role=listitem]>div]:border-t">
          {q.ms.length === 0 && <p className="px-4 py-3 text-[13px] text-muted">No milestones yet. Add the first step below.</p>}
          <SortableList
            items={q.ms}
            getKey={(m) => m.id}
            label={(m) => `Move ${m.title}`}
            onReorder={(ids) => void reorderMilestones(ids)}
            renderItem={(m, handle, dragging) => {
              const late = dueState(m, today) === 'late';
              return (
                <div
                  className={`flex items-center gap-2.5 border-line bg-surface py-2.5 pl-3.5 pr-1 ${dragging ? 'rounded-btn shadow-[var(--shadow)]' : ''}`}
                >
                  <CheckButton done={m.done} title={m.title} onToggle={() => void toggleMilestone(m.id)} />
                  <button type="button" onClick={() => setEditing(m)} className="min-w-0 flex-1 py-1 text-left">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className={`text-[15px] font-semibold ${m.done ? 'text-muted line-through' : ''}`}>{m.title}</span>
                      {q.next?.id === m.id && (
                        <span className="rounded-[5px] bg-violet-soft px-1.5 py-0.5 text-[11px] font-extrabold text-violet-ink">Up next</span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-[13px] text-muted">
                      {owner(m.owner_id)} ·{' '}
                      {m.done ? (
                        <span>{doneLabel(m.done_at, today)}</span>
                      ) : (
                        <span className={late ? 'font-bold text-rose-ink' : ''}>{relDue(m.due, today)}</span>
                      )}
                    </span>
                  </button>
                  <button type="button" {...handle} className="inline-flex h-11 w-9 shrink-0 items-center justify-center rounded-ctl text-muted">
                    <GripVertical size={18} aria-hidden />
                  </button>
                </div>
              );
            }}
          />
        </div>
      </section>

      <Card>
        <form onSubmit={add} className="flex flex-col gap-3">
          <Field label="Add a milestone">
            {(fid) => (
              <input id={fid} value={form.title} maxLength={120} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="What needs doing?" autoComplete="off" className={inputClass} />
            )}
          </Field>
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Owner">
              {(fid) => (
                <select id={fid} value={form.owner || me?.id || ''} onChange={(e) => setForm({ ...form, owner: e.target.value })} className={inputClass}>
                  <option value="">Unassigned</option>
                  {people.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                      {x.me ? ' (you)' : ''}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Due">
              {(fid) => <input id={fid} type="date" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} className={inputClass} />}
            </Field>
          </div>
          {error && <Notice tone="rose">{error}</Notice>}
          <Button type="submit" variant="violet" icon={Plus}>
            Add milestone
          </Button>
        </form>
      </Card>

      <ProjectSheet project={p} open={sheet === 'edit'} onClose={() => setSheet(null)} onDeleted={() => navigate(b ? `/work/b/${b.id}` : '/work', { replace: true })} />
      <MilestoneSheet milestone={editing} open={!!editing} onClose={() => setEditing(null)} />
    </>
  );
}
