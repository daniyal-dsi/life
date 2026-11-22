// Reads Masjid Mubarak congregation times out of a WhatsApp timings message.
// Handles 12 or 24 hour times, several prayers sharing a time ("Zuhr & Asr
// 1:15pm"), "Maghrib: Sunset", Jumu'ah, and a "from <date>" line. Pure, tested
// by parse.test.ts; written so other message types can sit beside it later.

export type MosqueKey = 'fajr' | 'zuhr' | 'asr' | 'maghrib' | 'isha' | 'jumuah';
export const MOSQUE_KEYS: MosqueKey[] = ['fajr', 'zuhr', 'asr', 'maghrib', 'isha', 'jumuah'];
/** "HH:MM" (24 hour) or "sunset". */
export type MosqueTimes = Partial<Record<MosqueKey, string>>;

const NAMES: [MosqueKey, RegExp][] = [
  ['fajr', /\b(?:fajr|fajar|subh|subuh)\b/gi],
  ['zuhr', /\b(?:zuhr|zohr|dhuhr|duhr|zuhar|zuhur|zohar|dhuhur)\b/gi],
  ['asr', /\b(?:asr|asar)\b/gi],
  ['maghrib', /\b(?:maghrib|magrib|maghreb)\b/gi],
  ['isha', /\b(?:isha|esha|ishaa|isha'a)\b/gi],
  ['jumuah', /\b(?:jumu'?ah|jum'?ah|jumma|jummah|juma|friday prayer)\b/gi]
];
const TIME = /(\d{1,2})(?:[:.](\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/i;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const pad = (n: number) => String(n).padStart(2, '0');

/** A time in a segment of text, guessing am or pm from the prayer when it isn't given. */
function readTime(seg: string, key: MosqueKey): string | null {
  // A bare number only counts with am/pm ("1pm"); otherwise it needs minutes.
  const re = new RegExp(TIME.source, 'gi');
  for (const m of seg.matchAll(re)) {
    if (m[2] === undefined && !m[3]) continue;
    let h = Number(m[1]);
    const min = Number(m[2] ?? 0);
    const ap = (m[3] ?? '').toLowerCase().replace(/\./g, '');
    if (ap === 'pm' && h < 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    if (!ap) {
      if (key === 'zuhr' || key === 'jumuah') {
        if (h < 11) h += 12;
      } else if (key !== 'fajr' && h < 12) h += 12;
    }
    if (h < 24 && min < 60) return `${pad(h)}:${pad(min)}`;
  }
  return null;
}

function readFrom(line: string, today: string): string | null {
  const lead = /(?:from|starting|start(?:s|ing)? on|wef|w\.e\.f\.?|effective|as of|with effect from)\s*:?\s*(?:[a-z]+day,?\s*)?/i;
  const named = line.match(new RegExp(lead.source + /(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([a-z]{3,})\.?(?:\s+(\d{4}))?/.source, 'i'));
  const numeric = line.match(new RegExp(lead.source + /(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?/.source, 'i'));
  let day: number;
  let month: number;
  let year: number | null = null;
  if (named) {
    month = MONTHS.indexOf(named[2].slice(0, 3).toLowerCase());
    if (month < 0) return null;
    day = Number(named[1]);
    if (named[3]) year = Number(named[3]);
  } else if (numeric) {
    day = Number(numeric[1]);
    month = Number(numeric[2]) - 1;
    if (numeric[3]) year = Number(numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3]);
  } else return null;
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  // Without a year, pick the one that puts the date nearest today (up to 60 days back).
  const [ty] = today.split('-').map(Number);
  let y = year ?? ty;
  const iso = (yy: number) => `${yy}-${pad(month + 1)}-${pad(day)}`;
  if (!year) {
    const days = (a: string, b: string) => (Date.parse(a) - Date.parse(b)) / 864e5;
    if (days(iso(y), today) < -60) y += 1;
    else if (days(iso(y), today) > 305) y -= 1;
  }
  return iso(y);
}

export function parseMosque(text: string, today: string): { times: MosqueTimes; from: string | null } {
  const times: MosqueTimes = {};
  let from: string | null = null;
  for (const line of String(text ?? '').split(/\n|;|\|/)) {
    if (!from) from = readFrom(line, today);
    // Every prayer name in the line, in order.
    const hits = NAMES.flatMap(([key, re]) => [...line.matchAll(re)].map((m) => ({ key, start: m.index!, end: m.index! + m[0].length }))).sort(
      (a, b) => a.start - b.start
    );
    let pending: MosqueKey[] = [];
    hits.forEach((h, i) => {
      pending.push(h.key);
      const seg = line.slice(h.end, hits[i + 1]?.start ?? line.length);
      const sunset = /sunset|ghurub|ghuroob/i.test(seg);
      const t = sunset ? null : readTime(seg, h.key);
      if (!t && !sunset) return; // shares the next name's time ("Zuhr & Asr 1:15pm")
      for (const k of pending) {
        if (times[k]) continue;
        times[k] = sunset ? (k === 'maghrib' ? 'sunset' : undefined) : (readTime(seg, k) ?? t!);
        if (times[k] === undefined) delete times[k];
      }
      pending = [];
    });
  }
  return { times, from };
}
