import { useEffect, useState } from 'react';
import { BottomSheet, Button, Field, Notice, Segmented, inputClass } from '@/components/ui';
import { useWorkflow } from './store';
import { PRIORITIES, STATUSES, type Priority, type Project, type Status } from './types';

export default function ProjectSheet({
  project,
  bucketId,
  open,
  onClose,
  onDeleted
}: {
  project?: Project | null;
  bucketId?: string;
  open: boolean;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const { buckets, people, me, saveProject, deleteProject } = useWorkflow();
  const [f, setF] = useState({ bucket_id: '', name: '', description: '', priority: 'P2' as Priority, status: 'Planning' as Status, due: '', people: [] as string[] });
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setConfirm(false);
    setF(
      project
        ? { ...project, due: project.due ?? '', description: project.description ?? '' }
        : { bucket_id: bucketId ?? buckets[0]?.id ?? '', name: '', description: '', priority: 'P2', status: 'Planning', due: '', people: me ? [me.id] : [] }
    );
  }, [open, project, bucketId, buckets, me]);

  async function save() {
    const name = f.name.trim();
    if (!name) return setError('Give the project a name.');
    if (!f.bucket_id) return setError('Pick a bucket.');
    try {
      await saveProject(
        {
          bucket_id: f.bucket_id,
          name,
          description: f.description.trim(),
          priority: f.priority,
          status: f.status,
          due: f.due || null,
          people: f.people,
          ...(project?.sample ? { sample: true } : {})
        },
        project?.id
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    }
  }

  async function remove() {
    if (!project) return;
    if (!confirm) return setConfirm(true);
    await deleteProject(project.id);
    onClose();
    onDeleted?.();
  }

  const togglePerson = (id: string) =>
    setF((x) => ({ ...x, people: x.people.includes(id) ? x.people.filter((p) => p !== id) : [...x.people, id] }));

  return (
    <BottomSheet open={open} onClose={onClose} title={project ? 'Edit project' : 'New project'}>
      <div className="flex flex-col gap-4">
        <Field label="Name">
          {(id) => <input id={id} value={f.name} maxLength={80} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="What's the project?" className={inputClass} />}
        </Field>
        <Field label="Description (optional)">
          {(id) => (
            <textarea
              id={id}
              value={f.description}
              maxLength={500}
              onChange={(e) => setF({ ...f, description: e.target.value })}
              className="min-h-[72px] w-full rounded-btn border border-line2 bg-surface px-4 py-3 text-[16px]"
            />
          )}
        </Field>
        <Field label="Bucket">
          {(id) => (
            <select id={id} value={f.bucket_id} onChange={(e) => setF({ ...f, bucket_id: e.target.value })} className={inputClass}>
              {buckets.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
        </Field>
        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-muted">Priority</p>
          <Segmented label="Priority" options={PRIORITIES.map((p) => ({ id: p, label: p }))} value={f.priority} onChange={(priority) => setF({ ...f, priority })} />
        </div>
        <Field label="Status">
          {(id) => (
            <select id={id} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Status })} className={inputClass}>
              {STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Due date (optional)">
          {(id) => <input id={id} type="date" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} className={inputClass} />}
        </Field>
        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-muted">People</p>
          <div className="flex flex-wrap gap-2">
            {people.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={f.people.includes(p.id)}
                onClick={() => togglePerson(p.id)}
                className={`h-9 rounded-ctl border px-3 text-[14px] font-semibold ${f.people.includes(p.id) ? 'border-btn bg-btn text-btn-text' : 'border-line2 bg-surface'}`}
              >
                {p.name}
                {p.me ? ' (you)' : ''}
              </button>
            ))}
          </div>
        </div>
        {error && <Notice tone="rose">{error}</Notice>}
        <Button variant="violet" onClick={() => void save()}>
          {project ? 'Save project' : 'Add project'}
        </Button>
        {project && (
          <Button variant="danger" onClick={() => void remove()}>
            {confirm ? 'Tap again to delete it and its milestones' : 'Delete project'}
          </Button>
        )}
      </div>
    </BottomSheet>
  );
}
