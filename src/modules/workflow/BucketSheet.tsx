import { useEffect, useState } from 'react';
import { BottomSheet, Button, Field, Notice, inputClass } from '@/components/ui';
import { useWorkflow } from './store';
import { BUCKET_COLORS, type Bucket, type BucketColor } from './types';
import { stripe } from './parts';

export default function BucketSheet({ bucket, open, onClose }: { bucket?: Bucket | null; open: boolean; onClose: () => void }) {
  const { buckets, saveBucket, deleteBucket } = useWorkflow();
  const [name, setName] = useState('');
  const [color, setColor] = useState<BucketColor>('green');
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(bucket?.name ?? '');
    setColor(bucket?.color ?? 'green');
    setError(null);
    setConfirm(false);
  }, [open, bucket]);

  async function save() {
    const n = name.trim();
    if (!n) return setError('Give the bucket a name.');
    try {
      await saveBucket({ name: n, color, order: bucket?.order ?? buckets.length }, bucket?.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    }
  }

  async function remove() {
    if (!bucket) return;
    if (!confirm) return setConfirm(true);
    try {
      await deleteBucket(bucket.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete.');
      setConfirm(false);
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={bucket ? 'Edit bucket' : 'New bucket'}>
      <div className="flex flex-col gap-4">
        <Field label="Name">
          {(id) => <input id={id} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="e.g. Learning" className={inputClass} />}
        </Field>
        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-muted">Colour</p>
          <div className="flex gap-2.5" role="radiogroup" aria-label="Colour">
            {BUCKET_COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={color === c.id}
                aria-label={c.label}
                onClick={() => setColor(c.id)}
                className={`h-11 w-11 rounded-btn border-[3px] ${stripe[c.id]} ${color === c.id ? 'border-ink' : 'border-transparent'}`}
              />
            ))}
          </div>
        </div>
        {error && <Notice tone="rose">{error}</Notice>}
        <Button variant="violet" onClick={() => void save()}>
          {bucket ? 'Save bucket' : 'Add bucket'}
        </Button>
        {bucket && (
          <Button variant="danger" onClick={() => void remove()}>
            {confirm ? 'Tap again to delete' : 'Delete bucket'}
          </Button>
        )}
      </div>
    </BottomSheet>
  );
}
