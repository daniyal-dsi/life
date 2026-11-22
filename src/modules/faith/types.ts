import type { Current } from '@/lib/versioned';
import type { MosqueTimes } from './parse';
import type { PrayerId } from './score';

/** Personal: each person's prayer logs. */
export const TABLES = { prayers: 'faith_prayers' } as const;
/** Shared by the household: Masjid Mubarak congregation times. */
export const SHARED_TABLES = { mosque: 'faith_mosque' } as const;

/** One entity per date and prayer. `time` is minutes from the date's midnight (Isha after midnight is over 1440). */
export type PrayerData = {
  date: string;
  prayer: PrayerId;
  time: number;
  place: 'home' | 'mosque';
  /** Set on both logs when prayed together (Zuhr + Asr, Maghrib + Isha). */
  combined: PrayerId | null;
};

/** One entity per start date; the newest start on or before a date applies. */
export type MosqueData = { from: string; times: MosqueTimes; raw: string; source: 'paste' | 'whatsapp' };

export type PrayerLog = Current<PrayerData>;
export type MosqueUpdate = Current<MosqueData>;

/** Masjid Mubarak, Islamabad, Tilford: used until the phone's location is shared. */
export const TILFORD = { name: 'Tilford', lat: 51.185, lng: -0.746 };

export const PRAYER_NAMES: Record<PrayerId, { en: string; ar: string }> = {
  fajr: { en: 'Fajr', ar: 'الفجر' },
  zuhr: { en: 'Zuhr', ar: 'الظهر' },
  asr: { en: 'Asr', ar: 'العصر' },
  maghrib: { en: 'Maghrib', ar: 'المغرب' },
  isha: { en: 'Isha', ar: 'العشاء' }
};
export const JUMUAH = { en: "Jumu'ah", ar: 'الجمعة' };
