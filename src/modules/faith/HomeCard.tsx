import { Link } from 'react-router-dom';
import { ChevronRight, Moon } from 'lucide-react';
import { todayISO } from '@/lib/date';
import { hm } from './format';
import { usePrayerClock } from './Prayers';
import { dayScore, duePrayer, nextPrayer, PRAYER_IDS, shiftDate, status } from './score';
import { prayerName, useFaith } from './store';

// Home's Faith card: the prayer due now (or the next one) and today's
// on-time count. Needs FaithProvider above it.

export default function FaithHomeCard() {
  const f = useFaith();
  const now = usePrayerClock();
  const today = todayISO();
  if (f.loading) return null;
  const W = f.windows(today);
  const due = duePrayer(today, now, W, f.windows(shiftDate(today, -1)), (d, p) => !!f.logFor(d, p));
  const np = nextPrayer(today, now, W, f.windows(shiftDate(today, 1)));
  const mt = f.mosqueTime(np.date, np.prayer);
  const time = f.primary === 'mosque' && mt !== null ? mt : np.start;
  const score = dayScore(
    PRAYER_IDS.map((p) => status(today, p, W, f.logFor(today, p), today, now)),
    0
  );
  const shown = due ? prayerName(due.prayer, due.date) : prayerName(np.prayer, np.date);

  return (
    <Link to="/faith" className="flex items-center gap-3 rounded-card border border-gold bg-faith p-4 text-white">
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-ctl bg-white/10 text-gold-hi">
        <Moon size={20} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] opacity-80">{due ? `${shown.en} is due now` : 'Next prayer'}</span>
        <span className="block font-display text-[22px] font-extrabold">{due ? 'Tap to log it' : `${shown.en} · ${hm(time)}`}</span>
        <span className="block text-[13px] opacity-80">{score.ontime} of 5 on time today</span>
      </span>
      <span className="font-arabic text-[24px] text-gold-hi" lang="ar" dir="rtl">
        {shown.ar}
      </span>
      <ChevronRight size={18} aria-hidden />
    </Link>
  );
}
