import { useEffect, useState } from 'react';
import { BottomSheet, Button, Field, Notice, inputClass } from '@/components/ui';
import { projectMilestones, useWorkflow } from './store';
import type { Milestone } from './types';

// New task from the overview (pick bucket and project), or edit a milestone.

export default function MilestoneSheet({
  milestone,
  open,
  onClose
}: {
  milestone?: Milestone | null;
  open: boolean;
  onClose: () => void;
}) {
  const { buckets, projects, milestones, people, me, saveMilestone, deleteMilestone } = useWorkflow();
  const [bucketId, setBucketId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [title, setTitle] = useState('');
  const [owner, setOwner] = useState('');
  const [due, setDue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setConfirm(false);
    const p = milestone ? projects.find((x) => x.id === milestone.project_id) : undefined;
    const b = p?.bucket_id ?? buckets[0]?.id ?? '';
    setBucketId(b);
    setProjectId(milestone?.project_id ?? projects.find((x) => x.bucket_id === b && x.status !== 'Done')?.id ?? '');
    setTitle(milestone?.title ?? '');
    setOwner(milestone?.owner_id ?? me?.id ?? '');
    setDue(milestone?.due ?? '');
  }, [open, milestone, projects, buckets, me]);

  const bucketProjects = projects.filter((p) => p.bucket_id === bucketId).sort((a, b) => a.name.localeCompare(b.name));

  async function save() {
    const t = title.trim();
    if (!t) return setError('Say what needs doing.');
    if (!projectId) return setError('Pick a project.');
    const order = milestone && milestone.project_id === projectId ? milestone.order : projectMilestones(milestones, projectId).length;
    try {
      await saveMilestone(
        {
          project_id: projectId,
          title: t,
          owner_id: owner || null,
          due: due || null,
          done: milestone?.done ?? false,
          done_at: milestone?.done_at ?? null,
          order,
          ...(milestone?.sample ? { sample: true } : {})
        },
        milestone?.id
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    }
  }

  async function remove() {
    if (!milestone) return;
    if (!confirm) return setConfirm(true);
    await deleteMilestone(milestone.id);
    onClose();
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={milestone ? 'Edit milestone' : 'New task'}>
      <div className="flex flex-col gap-4">
        {!milestone && (
          <>
            <Field label="Bucket">
              {(id) => (
                <select
                  id={id}
                  value={bucketId}
                  onChange={(e) => {
                    setBucketId(e.target.value);
                    setProjectId(projects.find((p) => p.bucket_id === e.target.value && p.status !== 'Done')?.id ?? '');
                  }}
                  className={inputClass}
                >
                  {buckets.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            {bucketProjects.length === 0 ? (
              <Notice>This bucket has no projects yet. Add a project from the bucket's page first.</Notice>
            ) : (
              <Field label="Project">
                {(id) => (
                  <select id={id} value={projectId} onChange={(e) => setProjectId(e.target.value)} className={inputClass}>
                    {bucketProjects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.priority} · {p.name}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            )}
          </>
        )}
        <Field label="Task">
          {(id) => <input id={id} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="What needs doing?" autoComplete="off" className={inputClass} />}
        </Field>
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Owner">
            {(id) => (
              <select id={id} value={owner} onChange={(e) => setOwner(e.target.value)} className={inputClass}>
                <option value="">Unassigned</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.me ? ' (you)' : ''}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Due">
            {(id) => <input id={id} type="date" value={due} onChange={(e) => setDue(e.target.value)} className={inputClass} />}
          </Field>
        </div>
        {error && <Notice tone="rose">{error}</Notice>}
        <Button variant="violet" onClick={() => void save()} disabled={!milestone && bucketProjects.length === 0}>
          {milestone ? 'Save milestone' : 'Add task'}
        </Button>
        {milestone && (
          <Button variant="danger" onClick={() => void remove()}>
            {confirm ? 'Tap again to delete' : 'Delete milestone'}
          </Button>
        )}
      </div>
    </BottomSheet>
  );
}
