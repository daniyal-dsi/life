// Prayer windows, statuses and scores. Pure, tested by score.test.ts.
//
// On time = before the last hour of the window (the window ends when the next
// prayer starts; sunrise for Fajr). Late = within that last hour. Missed once
// the window ends, or "made up" if logged after it. Combined prayers are
// judged on the combined window.
import { calcTimes, type Asr, type DayTimes, type Place } from './times.ts';

export type PrayerId = 'fajr' | 'zuhr' | 'asr' | 'maghrib' | 'isha';
export const PRAYER_IDS: PrayerId[] = ['fajr', 'zuhr', 'asr', 'maghrib', 'isha'];

export type Window = { s: number; e: number };
export type Windows = Record<PrayerId, Window> & { sunrise: number };

/** A logged prayer: `time` in minutes from the date's midnight (Isha after midnight is over 1440). */
export type LogLike = { date: string; prayer: PrayerId; time: number; combined: PrayerId | null };

export type Status = 'ontime' | 'late' | 'qada' | 'early' | 'missed' | 'now' | 'lastHour' | 'upcoming';

export const PAIR: Partial<Record<PrayerId, PrayerId>> = { zuhr: 'asr', asr: 'zuhr', maghrib: 'isha', isha: 'maghrib' };

export function shiftDate(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const x = new Date(y, m - 1, d + n);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

export function windowsFrom(today: DayTimes, tomorrow: DayTimes): Windows {
  return {
    fajr: { s: today.fajr, e: today.sunrise },
    zuhr: { s: today.zuhr, e: today.asr },
    asr: { s: today.asr, e: today.maghrib },
    maghrib: { s: today.maghrib, e: today.isha },
    isha: { s: today.isha, e: tomorrow.fajr + 1440 },
    sunrise: today.sunrise
  };
}

export const windowsFor = (date: string, place: Place, asr: Asr) =>
  windowsFrom(calcTimes(date, place, asr), calcTimes(shiftDate(date, 1), place, asr));

export function judge(w: Window, t: number): 'early' | 'ontime' | 'late' | 'qada' {
  if (t < w.s) return 'early';
  if (t <= w.e - 60) return 'ontime';
  if (t <= w.e) return 'late';
  return 'qada';
}

/** The window a log is judged on: its own, or the pair's combined window. */
export function logWindow(w: Windows, prayer: PrayerId, combined: PrayerId | null): Window {
  if (!combined) return w[prayer];
  const a = w[prayer];
  const b = w[combined];
  return { s: Math.min(a.s, b.s), e: Math.max(a.e, b.e) };
}

/**
 * Status of one prayer. `now` is minutes after today's midnight. Yesterday's
 * Isha is still due after midnight until Fajr.
 */
export function status(date: string, prayer: PrayerId, w: Windows, log: LogLike | undefined, today: string, now: number): Status {
  if (log) return judge(logWindow(w, prayer, log.combined), log.time);
  const win = w[prayer];
  let n: number;
  if (date === today) n = now;
  else if (date === shiftDate(today, -1)) n = now + 1440;
  else return date < today ? 'missed' : 'upcoming';
  if (n < win.s) return 'upcoming';
  if (n > win.e) return 'missed';
  return n > win.e - 60 ? 'lastHour' : 'now';
}

export type DayScore = { ontime: number; late: number; other: number; logged: number; pct: number };

export function dayScore(statuses: Status[], logged: number): DayScore {
  const ontime = statuses.filter((s) => s === 'ontime').length;
  const late = statuses.filter((s) => s === 'late').length;
  const other = statuses.filter((s) => s === 'qada' || s === 'missed' || s === 'early').length;
  return { ontime, late, other, logged, pct: Math.round((100 * (ontime + 0.5 * late)) / 5) };
}

/** The next prayer to start (tomorrow's Fajr after Isha has started). */
export function nextPrayer(today: string, now: number, w: Windows, tomorrow: Windows): { date: string; prayer: PrayerId; start: number } {
  for (const p of PRAYER_IDS) if (w[p].s > now) return { date: today, prayer: p, start: w[p].s };
  return { date: shiftDate(today, 1), prayer: 'fajr', start: tomorrow.fajr.s };
}

/** A prayer whose window is open and that isn't logged yet (yesterday's Isha after midnight). */
export function duePrayer(
  today: string,
  now: number,
  w: Windows,
  yesterday: Windows,
  logged: (date: string, p: PrayerId) => boolean
): { date: string; prayer: PrayerId; window: Window; minutesLeft: number } | null {
  for (const p of PRAYER_IDS)
    if (now >= w[p].s && now <= w[p].e && !logged(today, p)) return { date: today, prayer: p, window: w[p], minutesLeft: w[p].e - now };
  const y = shiftDate(today, -1);
  if (now + 1440 <= yesterday.isha.e && !logged(y, 'isha'))
    return { date: y, prayer: 'isha', window: yesterday.isha, minutesLeft: yesterday.isha.e - (now + 1440) };
  return null;
}
