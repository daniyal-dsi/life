import { useEffect, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Copy, LocateFixed, Plus, Sun } from 'lucide-react';
import { StarMedallion } from '@/components/MihrabFrame';
import { Button, Card, IconButton, Notice, Segmented } from '@/components/ui';
import { formatLong, fromISODate, todayISO } from '@/lib/date';
import { useSettings } from '@/lib/settings';
import { hijri, hm, inMinutes, STATUS } from './format';
import MosqueSheet from './MosqueSheet';
import PrayerSheet, { type PrayerTarget } from './PrayerSheet';
import { dayScore, duePrayer, nextPrayer, PRAYER_IDS, shiftDate, status, type PrayerId, type Status } from './score';
import { prayerName, useFaith } from './store';

// Prayers: next prayer in the mihrab, today's list with statuses, logging
// (now, any time, or for an earlier day), adherence, the week grid, and
// where the times come from.

const nowMin = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};
const short = (iso: string) => fromISODate(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

/** Header part of the page, inside the mihrab arch. */
export function PrayerHero({ now, onLog }: { now: number; onLog: (t: PrayerTarget) => void }) {
  const f = useFaith();
  const today = todayISO();
  const W = f.windows(today);
  const np = nextPrayer(today, now, W, f.windows(shiftDate(today, 1)));
  const due = duePrayer(today, now, W, f.windows(shiftDate(today, -1)), (d, p) => !!f.logFor(d, p));
  const mt = f.mosqueTime(np.date, np.prayer);
  const useMosque = f.primary === 'mosque' && mt !== null;
  const big = useMosque ? mt : np.start;
  const left = (np.date === today ? big : big + 1440) - now;
  const name = prayerName(np.prayer, np.date);

  return (
    <section className="flex flex-col items-center gap-1 text-center">
      <p className="text-[11px] font-bold tracking-[0.1em] text-gold-ink">{hijri(new Date()).toUpperCase()}</p>
      <p className="mt-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">Next prayer</p>
      <p className="flex flex-wrap items-baseline justify-center gap-3">
        <span className="disp text-[26px]">{name.en}</span>
        <span className="font-arabic text-[24px] text-faith-ink" lang="ar" dir="rtl">
          {name.ar}
        </span>
      </p>
      <p className="disp tnum text-[52px] leading-none text-mh-time">{hm(big)}</p>
      <p className="mt-1 text-[14px] font-medium text-muted">
        {left > 0 ? `in ${inMinutes(left)}` : 'now'} · {useMosque ? 'Masjid Mubarak congregation' : 'Starts, calculated'}
      </p>
      <p className="mt-2 flex flex-wrap justify-center gap-1.5 text-[12px] font-semibold">
        {useMosque ? (
          <span className="rounded-chip bg-faith-soft px-2 py-1 text-faith-ink">Starts {hm(np.start)}</span>
        ) : (
          mt !== null && <span className="rounded-chip bg-faith-soft px-2 py-1 text-faith-ink">Mosque {hm(mt)}</span>
        )}
        <span className="rounded-chip bg-faith-soft px-2 py-1 text-faith-ink">{f.place.name}</span>
      </p>
      {due && (
        <div className="mt-4 flex w-full flex-col items-center gap-2">
          <Button
            icon={Check}
            className="!bg-gold !text-hero"
            onClick={() => onLog({ date: due.date, prayer: due.prayer, time: due.date === today ? now : now + 1440 })}
          >
            I've prayed {prayerName(due.prayer, due.date).en}
          </Button>
          <p className="text-[13px] text-muted">
            {prayerName(due.prayer, due.date).en} is due now ·{' '}
            {due.minutesLeft <= 60 ? `in its last hour, late until ${hm(due.window.e)}` : `on time until ${hm(due.window.e - 60)}`}
          </p>
        </div>
      )}
    </section>
  );
}

export function usePrayerClock() {
  const [now, setNow] = useState(nowMin);
  useEffect(() => {
    const t = window.setInterval(() => setNow(nowMin()), 20_000);
    return () => window.clearInterval(t);
  }, []);
  return now;
}

export default function Prayers({ now, sheet, setSheet }: { now: number; sheet: PrayerTarget | null; setSheet: (t: PrayerTarget | null) => void }) {
  const f = useFaith();
  const { settings, update } = useSettings();
  const today = todayISO();
  const [date, setDate] = useState(today);
  const [mosqueOpen, setMosqueOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const W = f.windows(date);

  const st = (d: string, p: PrayerId): Status => status(d, p, f.windows(d), f.logFor(d, p), today, now);
  const statuses = PRAYER_IDS.map((p) => st(date, p));
  const score = dayScore(statuses, PRAYER_IDS.filter((p) => f.logFor(date, p)).length);
  const monday = shiftDate(date, -((fromISODate(date).getDay() + 6) % 7));
  const mq = f.mosqueFor(today);

  // Unlogged pairs whose first prayer has started: offer one-tap combining.
  const combos = date === today ? (['zuhr', 'maghrib'] as const).filter((p) => now >= W[p].s && !f.logFor(today, p) && !f.logFor(today, p === 'zuhr' ? 'asr' : 'isha')) : [];

  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(() => setMessage(null), 4000);
    return () => window.clearTimeout(t);
  }, [message]);

  function locate() {
    if (!navigator.geolocation) return setMessage("This device can't share its location.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setLocating(false);
        // Rounded to about 100 m: plenty for prayer times.
        const loc = { name: 'Your location', lat: Math.round(pos.coords.latitude * 1000) / 1000, lng: Math.round(pos.coords.longitude * 1000) / 1000 };
        await update({ faith: { ...settings.faith, loc } });
        setMessage('Times are now calculated for your location.');
      },
      () => {
        setLocating(false);
        setMessage('Location not shared, so times stay calculated for Tilford.');
      },
      { maximumAge: 60 * 60 * 1000, timeout: 15_000 }
    );
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <IconButton icon={ChevronLeft} label="Previous day" onClick={() => setDate(shiftDate(date, -1))} />
        <button type="button" onClick={() => setDate(today)} className="text-center">
          <span className="block text-[16px] font-extrabold">{date === today ? 'Today' : short(date)}</span>
          <span className="block text-[13px] text-muted">{date === today ? short(date) : 'Tap for today'}</span>
        </button>
        <IconButton icon={ChevronRight} label="Next day" disabled={date >= today} onClick={() => setDate(shiftDate(date, 1))} />
      </div>
      {date !== today && <Notice tone="sun">Logging for {formatLong(fromISODate(date))}. Tap a prayer to enter the time you prayed it.</Notice>}
      {message && (
        <div role="status">
          <Notice>{message}</Notice>
        </div>
      )}

      <section className="rounded-card border border-line bg-surface py-1">
        {PRAYER_IDS.map((p, i) => {
          const s = statuses[i];
          const l = f.logFor(date, p);
          const mt = f.mosqueTime(date, p);
          const name = prayerName(p, date);
          const live = s === 'now' || s === 'lastHour';
          return (
            <div key={p}>
              {i === 1 && (
                <div className="flex items-center gap-1.5 border-t border-line py-1.5 pl-[60px] pr-4 text-[13px] font-semibold text-gold-ink">
                  <Sun size={14} aria-hidden />
                  Sunrise {hm(W.sunrise)} · Fajr ends
                </div>
              )}
              <button
                type="button"
                onClick={() => setSheet({ date, prayer: p, time: !l && date === today && live ? now : undefined })}
                aria-label={`${l ? 'Edit' : 'Log'} ${name.en}, ${STATUS[s].label}`}
                className={`flex w-full items-center gap-3 border-t py-3 pl-3 pr-4 text-left ${i === 0 ? 'border-t-0' : 'border-line'} ${live ? 'bg-gold/10' : ''}`}
              >
                <StarMedallion status={s} logged={!!l} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[16px] font-extrabold">{name.en}</span>
                    <span className="font-arabic text-[18px] text-faith-ink" lang="ar" dir="rtl">
                      {name.ar}
                    </span>
                  </span>
                  <span className="tnum block text-[13px] text-muted">
                    {hm(W[p].s)}–{hm(W[p].e)}
                    {mt !== null ? ` · Mosque ${hm(mt)}` : ''}
                  </span>
                  {l && (
                    <span className="tnum block text-[13px] font-bold">
                      Prayed {hm(l.time)}
                      {l.time >= 1440 ? ' (after midnight)' : ''}
                      {l.place === 'mosque' ? ' · at the mosque' : ''}
                      {l.combined ? ` · with ${prayerName(l.combined, date).en}` : ''}
                    </span>
                  )}
                </span>
                <span className={`shrink-0 rounded-chip px-2 py-1 text-[12px] font-extrabold ${STATUS[s].pill}`}>{STATUS[s].label}</span>
              </button>
            </div>
          );
        })}
      </section>

      {combos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {combos.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setSheet({ date: today, prayer: p, time: now, combine: true })}
              className="inline-flex h-10 items-center gap-1.5 rounded-ctl border border-line2 bg-surface px-3.5 text-[14px] font-semibold"
            >
              <Copy size={15} aria-hidden />
              Combine {prayerName(p, today).en} + {p === 'zuhr' ? 'Asr' : 'Isha'}
            </button>
          ))}
        </div>
      )}

      <Card>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-[18px] font-bold">{date === today ? "Today's adherence" : 'Adherence'}</h2>
          <span className="text-[13px] text-muted">{score.logged} of 5 logged</span>
        </div>
        <p className="mt-2.5 flex flex-wrap items-baseline gap-2">
          <span className="disp tnum text-[44px] leading-none text-faith-ink">
            {score.ontime}
            <span className="text-[22px] text-muted">/5</span>
          </span>
          <span className="font-semibold text-muted">
            on time{score.late ? ` · ${score.late} late` : ''}
            {score.other ? ` · ${score.other} missed or made up` : ''}
          </span>
        </p>
        <div className="mt-3.5 flex gap-1">
          {PRAYER_IDS.map((p, i) => (
            <span key={p} className="flex flex-1 flex-col items-center gap-1.5">
              <span className={`h-2.5 w-full rounded-full ${STATUS[statuses[i]].bar}`} />
              <span className="text-[11px] text-muted">{prayerName(p, date).en}</span>
            </span>
          ))}
        </div>
        <p className="mt-2.5 text-[13px] text-muted">
          On time = before the last hour of its window. Late = in that last hour. After the next prayer begins it counts as missed, or made up if you log it later.
        </p>
      </Card>

      <Card>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-[18px] font-bold">Week of {short(monday)}</h2>
          <span className="text-[13px] text-muted">Tap a day</span>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-1.5">
          {Array.from({ length: 7 }, (_, i) => shiftDate(monday, i)).map((d, i) => {
            const future = d > today;
            const ss = PRAYER_IDS.map((p) => st(d, p));
            const pct = dayScore(ss, 0).pct;
            return (
              <button
                key={d}
                type="button"
                disabled={future}
                aria-pressed={d === date}
                aria-label={`${formatLong(fromISODate(d))}${future ? '' : `, ${pct}%`}`}
                onClick={() => setDate(d)}
                className={`flex flex-col items-center gap-1 rounded-ctl py-1.5 ${d === date ? 'bg-faith-soft' : ''}`}
              >
                <span className={`text-[12px] ${d === date ? 'font-extrabold' : 'font-semibold'}`}>{'MTWTFSS'[i]}</span>
                {ss.map((s, k) => (
                  <i key={k} className={`h-2 w-4 rounded-[3px] ${future ? 'bg-chip' : STATUS[s].bar}`} />
                ))}
                <span className="tnum text-[11px] text-muted">{future ? '' : `${pct}%`}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-[12px] text-muted">
          {(['ontime', 'late', 'qada', 'missed'] as const).map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-[3px] ${STATUS[k].bar}`} />
              {k === 'qada' ? 'Made up' : STATUS[k].label}
            </span>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="font-display text-[18px] font-bold">Prayer times</h2>
        <div className="mt-3 flex flex-col gap-3.5">
          <div className="flex items-center gap-3">
            <span className="min-w-0 flex-1">
              <span className="block font-bold">Masjid Mubarak</span>
              <span className="text-[13px] text-muted">{mq ? `From ${short(mq.from)}${mq.source === 'whatsapp' ? ' · from WhatsApp' : ''}` : 'No times yet'}</span>
            </span>
            <button
              type="button"
              onClick={() => setMosqueOpen(true)}
              className="inline-flex h-10 items-center gap-1.5 rounded-ctl border border-line2 bg-surface px-3.5 text-[14px] font-semibold"
            >
              <Plus size={14} strokeWidth={2.5} aria-hidden />
              Paste message
            </button>
          </div>
          <div className="flex items-center gap-3">
            <span className="min-w-0 flex-1">
              <span className="block font-bold">Calculated times</span>
              <span className="text-[13px] text-muted">
                {f.place.name} · Asr {f.asr === 'hanafi' ? 'Hanafi' : 'standard'}
              </span>
            </span>
            <button
              type="button"
              onClick={locate}
              disabled={locating}
              className="inline-flex h-10 items-center gap-1.5 rounded-ctl border border-line2 bg-surface px-3.5 text-[14px] font-semibold"
            >
              <LocateFixed size={15} aria-hidden />
              {locating ? 'Finding…' : 'Use my location'}
            </button>
          </div>
          <div>
            <p className="mb-1.5 text-[13px] font-semibold text-muted">Main time shown</p>
            <Segmented
              label="Main time shown"
              options={[
                { id: 'mosque', label: 'Mosque' },
                { id: 'calc', label: 'Calculated' }
              ]}
              value={settings.faith.primary}
              onChange={(primary) => void update({ faith: { ...settings.faith, primary } })}
              activeClass="bg-faith text-white"
            />
          </div>
          <div>
            <p className="mb-1.5 text-[13px] font-semibold text-muted">Asr calculation</p>
            <Segmented
              label="Asr calculation"
              options={[
                { id: 'standard', label: 'Standard' },
                { id: 'hanafi', label: 'Hanafi' }
              ]}
              value={settings.faith.asr}
              onChange={(asr) => void update({ faith: { ...settings.faith, asr } })}
              activeClass="bg-faith text-white"
            />
          </div>
          <p className="text-[13px] text-muted">Calculated with Fajr at 18° and Isha at 17°, with a high-latitude rule for summer nights.</p>
        </div>
      </Card>

      <PrayerSheet target={sheet} onClose={() => setSheet(null)} />
      <MosqueSheet open={mosqueOpen} onClose={() => setMosqueOpen(false)} onSaved={setMessage} />
    </>
  );
}
