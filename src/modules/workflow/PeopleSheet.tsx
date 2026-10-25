import { useState, type FormEvent } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { BottomSheet, Button, Field, Notice, inputClass } from '@/components/ui';
import { useWorkflow } from './store';
import { initialsOf, type Person } from './types';

// People are names only (no accounts), reused across projects and milestones.

export default function PeopleSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { people, projects, milestones, savePerson, deletePerson } = useWorkflow();
  const [form, setForm] = useState<{ id?: string; name: string; role: string; me?: boolean }>({ name: '', role: '' });
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  const used = (id: string) => projects.some((p) => p.people.includes(id)) || milestones.some((m) => m.owner_id === id);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) return setError('Enter a name.');
    try {
      await savePerson({ name, initials: initialsOf(name), role: form.role.trim() || null, ...(form.me ? { me: true } : {}) }, form.id);
      setForm({ name: '', role: '' });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    }
  }

  const edit = (p: Person) => setForm({ id: p.id, name: p.name, role: p.role ?? '', me: p.me });

  return (
    <BottomSheet open={open} onClose={onClose} title="People">
      <div className="flex flex-col gap-4">
        <form onSubmit={submit} className="flex flex-col gap-3 rounded-card border border-line bg-bg p-4">
          <p className="font-extrabold">{form.id ? 'Edit person' : 'Add a person'}</p>
          <Field label="Name">
            {(id) => <input id={id} value={form.name} maxLength={60} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="off" className={inputClass} />}
          </Field>
          <Field label="Role (optional)">
            {(id) => <input id={id} value={form.role} maxLength={60} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="e.g. Designer" autoComplete="off" className={inputClass} />}
          </Field>
          {error && <Notice tone="rose">{error}</Notice>}
          <div className="flex gap-2">
            <Button type="submit" variant="violet">
              {form.id ? 'Save person' : 'Add person'}
            </Button>
            {form.id && (
              <Button variant="ghost" full={false} onClick={() => setForm({ name: '', role: '' })}>
                Cancel
              </Button>
            )}
          </div>
        </form>
        <ul className="flex flex-col gap-2">
          {people.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-btn border border-line bg-bg py-1.5 pl-3 pr-1">
              <span className="inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-chip text-[12px] font-extrabold">{p.initials}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold">
                  {p.name}
                  {p.me && <span className="font-normal text-muted"> (you)</span>}
                </span>
                {p.role && <span className="text-[13px] text-muted">{p.role}</span>}
              </span>
              <button type="button" aria-label={`Edit ${p.name}`} onClick={() => edit(p)} className="inline-flex h-10 w-10 items-center justify-center rounded-ctl text-muted">
                <Pencil size={16} aria-hidden />
              </button>
              {!p.me && (
                <button
                  type="button"
                  disabled={used(p.id)}
                  title={used(p.id) ? 'On a project or milestone' : undefined}
                  aria-label={confirm === p.id ? `Tap again to delete ${p.name}` : `Delete ${p.name}`}
                  onClick={() => (confirm === p.id ? void deletePerson(p.id).then(() => setConfirm(null)) : setConfirm(p.id))}
                  className={`inline-flex h-10 items-center justify-center rounded-ctl ${confirm === p.id ? 'bg-rose-soft px-2.5 text-[12px] font-bold text-rose-ink' : 'w-10 text-muted'}`}
                >
                  {confirm === p.id ? 'Delete?' : <Trash2 size={16} aria-hidden />}
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </BottomSheet>
  );
}
