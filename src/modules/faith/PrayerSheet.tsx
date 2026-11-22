import { useEffect, useState } from 'react';
import { BottomSheet, Button, Field, Notice, Segmented, Switch, inputClass } from '@/components/ui';
import { formatLong, fromISODate } from '@/lib/date';
import { judge, logWindow, PAIR, type PrayerId } from './score';
import { prayerName, useFaith } from './store';
import { hm, STATUS } from './format';

// Log or edit one prayer: the time prayed, where, and whether it was combined
// with its pair (Zuhr + Asr, Maghrib + Isha), which logs both.

/** `time` prefills the time; `combine` starts with the pair switched on. */
export type PrayerTarget = { date: string; prayer: PrayerId; time?: number; combine?: boolean };

export default function PrayerSheet({ target, onClose }: { target: PrayerTarget | null; onClose: () => void }) {
  const { windows, logFor, logPrayer, removeLog } = useFaith();
  const [time, setTime] = useState('');
  const [place, setPlace] = useState<'home' | 'mosque'>('home');
  const [combined, setCombined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (!target) return;
    const l = logFor(target.date, target.prayer);
    const w = windows(target.date)[target.prayer];
    setTime(hm(l?.time ?? target.time ?? w.s + 10));
    setPlace(l?.place ?? 'home');
    setCombined(l ? !!l.combined : !!target.combine);
    setError(null);
    setConfirm(false);
  }, [target]);

  if (!target) return null;
  const { date, prayer } = target;
  const W = windows(date);
  const w = W[prayer];
  const pair = PAIR[prayer] ?? null;
  const existing = logFor(date, prayer);
  const name = prayerName(prayer, date);

  /** Minutes from the date's midnight; Isha before noon is after midnight. */
  const minutes = () => {
    const [h, m] = time.split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    const t = h * 60 + m;
    return prayer === 'isha' && t < 12 * 60 ? t + 1440 : t;
  };
  const t = minutes();
  const win = logWindow(W, prayer, combined ? pair : null);
  const j = t === null ? null : judge(win, t);
  const hint =
    j === 'ontime' ? `Before ${hm(win.e - 60)}` : j === 'late' ? `In the last hour before ${hm(win.e)}` : j === 'early' ? `Its time starts at ${hm(win.s)}` : `After ${hm(win.e)}`;

  async function save() {
    if (t === null) return setError('Enter the time you prayed.');
    try {
      await logPrayer({ date, prayer, time: t, place, combined: combined ? pair : null });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    }
  }

  return (
    <BottomSheet open onClose={onClose} title={name.en}>
      <div className="flex flex-col gap-4">
        <p className="-mt-2 text-[13px] text-muted">
          <span className="font-arabic text-[18px] text-faith-ink" lang="ar" dir="rtl">
            {name.ar}
          </span>{' '}
          · {formatLong(fromISODate(date))} · window {hm(w.s)}–{hm(w.e)}
        </p>
        <Field label="Time you prayed">{(id) => <input id={id} type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputClass} />}</Field>
        {j && (
          <div className="flex items-center gap-2">
            <span className={`rounded-chip px-2 py-1 text-[12px] font-extrabold ${STATUS[j].pill}`}>{STATUS[j].label}</span>
            <span className="text-[13px] text-muted">{hint}</span>
          </div>
        )}
        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-muted">Where</p>
          <Segmented
            label="Where"
            options={[
              { id: 'home', label: 'Home or elsewhere' },
              { id: 'mosque', label: 'At the mosque' }
            ]}
            value={place}
            onChange={setPlace}
            activeClass="bg-faith text-white"
          />
        </div>
        {pair && (
          <div className="flex items-center justify-between gap-3">
            <span>
              <span className="block font-semibold">Combined with {prayerName(pair, date).en}</span>
              <span className="text-[13px] text-muted">Logs both prayers at this time</span>
            </span>
            <Switch checked={combined} onChange={setCombined} label={`Combined with ${prayerName(pair, date).en}`} />
          </div>
        )}
        {error && <Notice tone="rose">{error}</Notice>}
        <Button className="!bg-gold !text-hero" onClick={() => void save()}>
          {existing ? 'Save' : 'Log prayer'}
        </Button>
        {existing && (
          <Button
            variant="danger"
            onClick={async () => {
              if (!confirm) return setConfirm(true);
              await removeLog(date, prayer);
              onClose();
            }}
          >
            {confirm ? 'Tap again to confirm' : 'Remove this log'}
          </Button>
        )}
      </div>
    </BottomSheet>
  );
}
