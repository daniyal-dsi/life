// Date helpers. Days are local-time ISO strings (YYYY-MM-DD); weeks start on Monday.

const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

export function startOfWeek(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const offset = (out.getDay() + 6) % 7; // Monday = 0
  return addDays(out, -offset);
}

export function weekDays(d: Date): Date[] {
  const start = startOfWeek(d);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function isSameDay(a: Date, b: Date): boolean {
  return toISODate(a) === toISODate(b);
}

const LOCALE = 'en-GB';

/** "Saturday 25 October" */
export function formatLong(d: Date): string {
  return d.toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' });
}

/** "October 2026" */
export function formatMonth(d: Date): string {
  return d.toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' });
}

/** "Mon" */
export function formatWeekday(d: Date): string {
  return d.toLocaleDateString(LOCALE, { weekday: 'short' });
}

/** "14:05" */
export function formatTime(d: Date): string {
  return d.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
}

/** "25 Oct, 14:05" for a stored timestamp. */
export function formatStamp(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' })}, ${formatTime(d)}`;
}

export function greeting(d: Date = new Date()): string {
  const h = d.getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}
