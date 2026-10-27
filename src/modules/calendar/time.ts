// Relative .ts imports so Node can run time.test.ts directly.
import { fromISODate } from '../../lib/date.ts';
import { CAL_END, CAL_START, DEFAULT_WORK, type Block, type Item, type WorkRow } from './types.ts';

const pad = (n: number) => String(n).padStart(2, '0');

/** 570 -> "09:30". */
export const hhmm = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
/** "09:30" -> 570. */
export const toMin = (s: string) => {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + (m || 0);
};
export const snap15 = (min: number) => Math.round(min / 15) * 15;
export const clampDay = (min: number, len = 15) => Math.max(CAL_START * 60, Math.min(min, CAL_END * 60 - len));

/** "1h 30m". */
export function duration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`;
}

export const isWeekday = (date: string) => {
  const d = fromISODate(date).getDay();
  return d >= 1 && d <= 5;
};

/** Usual hours, and the per-day row for a date (if any). */
export function workFor(rows: WorkRow[], date: string) {
  const usual = rows.find((r) => r.kind === 'usual') as (WorkRow & { kind: 'usual' }) | undefined;
  const day = rows.find((r) => r.kind === 'day' && r.date === date) as (WorkRow & { kind: 'day' }) | undefined;
  const base = usual ? { start_min: usual.start_min, end_min: usual.end_min } : DEFAULT_WORK;
  if (day) return day.off ? null : { start_min: day.start_min, end_min: day.end_min, custom: true };
  return isWeekday(date) ? { ...base, custom: false } : null;
}

/** Everything on a day: stored blocks plus work hours. */
export function itemsFor(date: string, blocks: Block[], work: WorkRow[]): Item[] {
  const out: Item[] = blocks.filter((b) => b.date === date).map((b) => ({ type: 'block' as const, id: b.id, date, start: b.start_min, end: b.end_min, block: b }));
  const w = workFor(work, date);
  if (w) out.push({ type: 'work', id: `work|${date}`, date, start: w.start_min, end: w.end_min });
  return out;
}

/** Side-by-side lanes for overlapping items. */
export function lanes<T extends { start: number; end: number }>(items: T[]): (T & { lane: number; lanes: number })[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: (T & { lane: number; lanes: number })[] = [];
  let group: (T & { lane: number; lanes: number })[] = [];
  let groupEnd = -1;
  const close = () => {
    const n = Math.max(1, ...group.map((g) => g.lane + 1));
    group.forEach((g) => (g.lanes = n));
    out.push(...group);
    group = [];
  };
  for (const it of sorted) {
    if (group.length && it.start >= groupEnd) close();
    const ends: number[] = [];
    for (const g of group) ends[g.lane] = Math.max(ends[g.lane] ?? 0, g.end);
    let lane = 0;
    while (ends[lane] !== undefined && ends[lane] > it.start) lane++;
    group.push({ ...it, lane, lanes: 1 });
    groupEnd = Math.max(groupEnd, it.end);
  }
  if (group.length) close();
  return out;
}
