import type { Status } from './score';

const pad = (n: number) => String(n).padStart(2, '0');

/** Minutes (any day offset) -> "HH:MM". */
export const hm = (min: number) => {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
};

/** "2h 05m" or "25 min". */
export function inMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const r = Math.round(min % 60);
  return h ? `${h}h ${pad(r)}m` : `${r} min`;
}

/** Label, pill classes and bar colour per status. */
export const STATUS: Record<Status, { label: string; pill: string; bar: string }> = {
  ontime: { label: 'On time', pill: 'bg-green-soft text-green-ink', bar: 'bg-green' },
  late: { label: 'Late', pill: 'bg-sun-soft text-sun-ink', bar: 'bg-sun' },
  qada: { label: 'Made up later', pill: 'bg-violet-soft text-violet-ink', bar: 'bg-violet' },
  missed: { label: 'Missed', pill: 'bg-rose-soft text-rose-ink', bar: 'bg-rose' },
  early: { label: 'Before its time', pill: 'bg-rose-soft text-rose-ink', bar: 'bg-rose' },
  now: { label: 'Due now', pill: 'bg-gold text-hero', bar: 'bg-line2' },
  lastHour: { label: 'Last hour', pill: 'bg-sun-soft text-sun-ink', bar: 'bg-line2' },
  upcoming: { label: 'Upcoming', pill: 'bg-chip text-muted', bar: 'bg-line2' }
};

export function hijri(d: Date): string {
  try {
    const s = new Intl.DateTimeFormat('en-GB-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
    return `${s.replace(/\s?AH$/, '')} AH`;
  } catch {
    return '';
  }
}
