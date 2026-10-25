import { useEffect, useState } from 'react';
import { BottomSheet, Button, Card, Field, Notice, Segmented, inputClass } from '@/components/ui';
import { parseDecimal } from '@/lib/number';
import { useFuelLog } from './store';
import { targets } from './targets';
import { ACTIVITIES, GOALS, type Activity, type Goal, type ProfileData, type Sex } from './types';

// Body profile. Targets update live as you type; saving adds a new dated
// version, so past days keep the target they had.

type Form = { weight: string; height: string; age: string; sex: Sex; activity: Activity; goal: Goal };

export default function ProfileSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile, saveProfile } = useFuelLog();
  const [f, setF] = useState<Form>({ weight: '', height: '', age: '', sex: 'male', activity: 'moderate', goal: 'maintain' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (profile)
      setF({
        weight: String(profile.weight_kg),
        height: String(profile.height_cm),
        age: String(profile.age),
        sex: profile.sex,
        activity: profile.activity,
        goal: profile.goal
      });
  }, [open, profile]);

  const parsed: ProfileData = {
    weight_kg: parseDecimal(f.weight),
    height_cm: parseDecimal(f.height),
    age: parseDecimal(f.age),
    sex: f.sex,
    activity: f.activity,
    goal: f.goal
  };
  const valid =
    parsed.weight_kg >= 30 && parsed.weight_kg <= 300 && parsed.height_cm >= 120 && parsed.height_cm <= 230 && Number.isInteger(parsed.age) && parsed.age >= 14 && parsed.age <= 100;
  const T = valid ? targets(parsed) : null;
  const n = (x: number) => x.toLocaleString('en-GB');

  async function save() {
    if (!valid) return setError('Check your weight (30 to 300 kg), height (120 to 230 cm) and age (14 to 100).');
    setBusy(true);
    try {
      await saveProfile({ ...parsed, weight_kg: Math.round(parsed.weight_kg * 10) / 10, height_cm: Math.round(parsed.height_cm) });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your profile.');
    } finally {
      setBusy(false);
    }
  }

  const set = (k: 'weight' | 'height' | 'age') => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  return (
    <BottomSheet open={open} onClose={onClose} title="Your profile">
      <div className="flex flex-col gap-4">
        {profile?.sample && <Notice tone="sun">This is a sample profile. Enter your own details to get your targets.</Notice>}
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Weight (kg)">{(id) => <input id={id} inputMode="decimal" value={f.weight} onChange={set('weight')} className={`${inputClass} tnum`} />}</Field>
          <Field label="Height (cm)">{(id) => <input id={id} inputMode="numeric" value={f.height} onChange={set('height')} className={`${inputClass} tnum`} />}</Field>
          <Field label="Age">{(id) => <input id={id} inputMode="numeric" value={f.age} onChange={set('age')} className={`${inputClass} tnum`} />}</Field>
          <Field label="Sex">
            {(id) => (
              <select id={id} value={f.sex} onChange={(e) => setF({ ...f, sex: e.target.value as Sex })} className={inputClass}>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            )}
          </Field>
        </div>
        <Field label="Activity level">
          {(id) => (
            <select id={id} value={f.activity} onChange={(e) => setF({ ...f, activity: e.target.value as Activity })} className={inputClass}>
              {ACTIVITIES.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          )}
        </Field>
        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-muted">Goal</p>
          <Segmented label="Goal" options={GOALS} value={f.goal} onChange={(goal) => setF({ ...f, goal })} />
        </div>

        <Card dark className="!p-[18px]">
          <p className="text-[13px] text-hero-muted">Your daily target</p>
          <p className="mt-1.5 flex items-baseline gap-1.5">
            <span className="disp tnum text-[48px] text-green-hi [text-shadow:var(--glow-green)]">{T ? n(T.kcal) : '–'}</span>
            <span className="text-[18px] font-semibold text-hero-muted">kcal</span>
          </p>
          <div className="mt-3.5 grid grid-cols-3 gap-2">
            {(
              [
                ['Protein', T?.protein, 'text-coral'],
                ['Carbs', T?.carbs, 'text-sun'],
                ['Fat', T?.fat, 'text-violet-hi']
              ] as const
            ).map(([label, v, cls]) => (
              <div key={label} className="rounded-btn bg-white/10 px-3 py-2.5">
                <p className="text-[12px] text-hero-muted">{label}</p>
                <p className={`tnum text-[18px] font-extrabold ${cls}`}>{v === undefined ? '–' : `${v} g`}</p>
              </div>
            ))}
          </div>
          {T && (
            <p className="mt-3 text-[12px] leading-relaxed text-hero-muted">
              Mifflin-St Jeor resting rate {n(T.bmr)} kcal × activity = {n(T.tdee)} kcal
              {f.goal === 'lose' ? ', minus 15%' : f.goal === 'gain' ? ', plus 10%' : ''}. Protein at 2 g per kg, fat at 25% of
              calories, carbs make up the rest.
            </p>
          )}
        </Card>

        {error && <Notice tone="rose">{error}</Notice>}
        <Button variant="green" onClick={() => void save()} disabled={busy}>
          {busy ? 'Saving…' : 'Save profile'}
        </Button>
      </div>
    </BottomSheet>
  );
}
