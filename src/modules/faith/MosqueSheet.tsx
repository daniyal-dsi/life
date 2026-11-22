import { useEffect, useState } from 'react';
import { BottomSheet, Button, Field, Notice, inputClass } from '@/components/ui';
import { fromISODate, todayISO } from '@/lib/date';
import { MOSQUE_KEYS, parseMosque, type MosqueKey } from './parse';
import { useFaith } from './store';

// Masjid Mubarak times from the WhatsApp timings message: paste, check the
// preview, save with its start date. Shared with the household; each update
// is kept.

const LABEL: Record<MosqueKey, string> = { fajr: 'Fajr', zuhr: 'Zuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha', jumuah: "Jumu'ah" };
const EXAMPLE = `Assalamu Alaikum. Masjid Mubarak prayer timings from Monday 2nd November:
Fajr 6:00am
Zuhr & Asr 1:15pm
Maghrib: Sunset
Isha 7:30pm
Jumu'ah 1:00pm`;
const short = (iso: string) => fromISODate(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

export default function MosqueSheet({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: (m: string) => void }) {
  const { mosque, saveMosque } = useFaith();
  const [text, setText] = useState('');
  const [from, setFrom] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setText('');
    setFrom('');
    setError(null);
  }, [open]);

  if (!open) return null;
  const today = todayISO();
  const parsed = parseMosque(text, today);
  const found = MOSQUE_KEYS.filter((k) => parsed.times[k]);
  const start = from || parsed.from || today;

  async function save() {
    try {
      await saveMosque({ from: start, times: parsed.times, raw: text.slice(0, 4000), source: 'paste' });
      onSaved(`Masjid Mubarak times updated from ${short(start)}.`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    }
  }

  return (
    <BottomSheet open onClose={onClose} title="Masjid Mubarak times">
      <div className="flex flex-col gap-4">
        <p className="text-[14px] text-muted">In WhatsApp, press and hold the timings message, tap Copy, then paste it here. The app reads the times out of it.</p>
        <Field label="Message">
          {(id) => (
            <textarea
              id={id}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste the WhatsApp message"
              className={`${inputClass} !h-auto min-h-[150px] py-3`}
            />
          )}
        </Field>
        {!text && (
          <button type="button" onClick={() => setText(EXAMPLE)} className="h-10 self-start rounded-ctl border border-line2 bg-surface px-4 text-[14px] font-semibold">
            Try an example message
          </button>
        )}
        {text && (
          <div className="rounded-btn border border-line bg-bg p-3.5">
            <p className="mb-2 font-extrabold">Times found</p>
            {found.length ? (
              <div className="grid grid-cols-3 gap-2">
                {MOSQUE_KEYS.map((k) => (
                  <div key={k}>
                    <p className="text-[12px] text-muted">{LABEL[k]}</p>
                    <p className={`tnum text-[18px] font-extrabold ${parsed.times[k] ? '' : 'text-muted'}`}>
                      {parsed.times[k] === 'sunset' ? 'Sunset' : parsed.times[k] ?? '–'}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-muted">No prayer times found yet. Check the message has prayer names and times like "Zuhr 1:15pm".</p>
            )}
          </div>
        )}
        {text && (
          <Field label="Applies from" hint={parsed.from && !from ? 'Date read from the message.' : undefined}>
            {(id) => <input id={id} type="date" value={start} onChange={(e) => setFrom(e.target.value)} className={inputClass} />}
          </Field>
        )}
        {error && <Notice tone="rose">{error}</Notice>}
        <Button className="!bg-gold !text-hero" disabled={!found.length} onClick={() => void save()}>
          Update Masjid Mubarak times
        </Button>
        {mosque.length > 0 && (
          <div>
            <p className="mb-1.5 text-[13px] font-extrabold text-muted">Recent updates</p>
            <div className="flex flex-col divide-y divide-line rounded-btn border border-line bg-surface">
              {mosque.slice(0, 4).map((m) => (
                <div key={m.id} className="px-3.5 py-2.5">
                  <p className="font-bold">
                    From {short(m.from)}
                    {m.source === 'whatsapp' ? ' · via WhatsApp' : ''}
                  </p>
                  <p className="tnum text-[13px] text-muted">
                    {(['fajr', 'zuhr', 'asr', 'maghrib', 'isha'] as const).map((k) => `${LABEL[k]} ${m.times[k] === 'sunset' ? 'sunset' : m.times[k] ?? '–'}`).join(' · ')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
        <p className="text-[13px] text-muted">Shared with your household.</p>
      </div>
    </BottomSheet>
  );
}
