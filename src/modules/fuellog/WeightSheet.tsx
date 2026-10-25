import { useEffect, useState } from 'react';
import { BottomSheet, Button, Field, Notice, inputClass } from '@/components/ui';
import { todayISO } from '@/lib/date';
import { parseDecimal } from '@/lib/number';
import { useFuelLog } from './store';

export default function WeightSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { saveWeight, weights } = useFuelLog();
  const [date, setDate] = useState(todayISO());
  const [kg, setKg] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDate(todayISO());
    setKg('');
    setError(null);
  }, [open]);

  const existing = weights.find((w) => w.date === date);

  async function save() {
    const v = parseDecimal(kg);
    if (!Number.isFinite(v) || v < 30 || v > 300) return setError('Enter your weight in kg (30 to 300).');
    if (date > todayISO()) return setError("The date can't be in the future.");
    try {
      await saveWeight({ date, kg: Math.round(v * 10) / 10 });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Log weight">
      <div className="flex flex-col gap-4">
        <Field label="Date">
          {(id) => <input id={id} type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} className={inputClass} />}
        </Field>
        <Field label="Weight (kg)" hint={existing ? `Replaces the ${existing.kg} kg logged for this day.` : undefined}>
          {(id) => (
            <input id={id} inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} placeholder="e.g. 82.4" className={`${inputClass} tnum`} />
          )}
        </Field>
        {error && <Notice tone="rose">{error}</Notice>}
        <Button variant="green" onClick={() => void save()}>
          Save weight
        </Button>
      </div>
    </BottomSheet>
  );
}
