import { fromISODate } from '@/lib/date';

/** 92.5 -> "92.5", 90 -> "90". */
export function kg(w: number): string {
  const r = Math.round(w * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

export function num(n: number): string {
  return Math.round(n).toLocaleString('en-GB');
}

/** 12345 -> "12.3k". */
export function k1(n: number): string {
  return n >= 1000 ? `${(Math.round(n / 100) / 10).toFixed(1).replace(/\.0$/, '')}k` : num(n);
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** "Mon 20 Oct" */
export function dayLabel(iso: string): string {
  return fromISODate(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** "20 Oct" */
export function shortDate(iso: string): string {
  return fromISODate(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function monthName(iso: string): string {
  return fromISODate(iso).toLocaleDateString('en-GB', { month: 'long' });
}
