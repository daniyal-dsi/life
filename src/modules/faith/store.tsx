import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useHousehold } from '@/lib/household';
import { useSettings } from '@/lib/settings';
import { dataOf, useVersionedTables } from '@/lib/useVersioned';
import { currentOf, newVersion, stableId, type Version } from '@/lib/versioned';
import { fromISODate } from '@/lib/date';
import type { MosqueKey } from './parse';
import { windowsFor, type PrayerId, type Windows } from './score';
import { calcTimes, type Asr, type Place } from './times';
import { JUMUAH, PRAYER_NAMES, SHARED_TABLES, TABLES, TILFORD, type MosqueData, type MosqueUpdate, type PrayerData, type PrayerLog } from './types';

type FaithState = {
  loading: boolean;
  error: string | null;
  householdId: string | null;
  logs: PrayerLog[];
  mosque: MosqueUpdate[];
  place: Place & { name: string };
  asr: Asr;
  primary: 'mosque' | 'calc';
  windows: (date: string) => Windows;
  logFor: (date: string, p: PrayerId) => PrayerLog | undefined;
  /** Mosque congregation time in minutes, or null ("sunset" uses calculated Maghrib). */
  mosqueTime: (date: string, p: PrayerId) => number | null;
  mosqueFor: (date: string) => MosqueUpdate | null;
  logPrayer: (d: PrayerData) => Promise<void>;
  removeLog: (date: string, p: PrayerId) => Promise<void>;
  saveMosque: (d: MosqueData) => Promise<void>;
};

const Ctx = createContext<FaithState | null>(null);
const NO_SEED = { needsSeed: () => false, seed: async () => ({}) };

export const isFriday = (date: string) => fromISODate(date).getDay() === 5;
export const prayerName = (p: PrayerId, date: string) => (p === 'zuhr' && isFriday(date) ? JUMUAH : PRAYER_NAMES[p]);

export function FaithProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const { household } = useHousehold();
  const householdId = household?.id ?? null;
  const own = useVersionedTables(TABLES, NO_SEED);
  const sharedOptions = useMemo(() => ({ ...NO_SEED, householdId }), [householdId]);
  const shared = useVersionedTables(SHARED_TABLES, sharedOptions);
  const { reload } = shared;

  // Shared times: pick up the other person's update when coming back to the app.
  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && reload();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [reload]);

  const logs = useMemo(() => currentOf(own.versions.prayers as Version<PrayerData>[]), [own.versions.prayers]);
  const mosque = useMemo(
    () => currentOf(shared.versions.mosque as Version<MosqueData>[]).sort((a, b) => b.from.localeCompare(a.from)),
    [shared.versions.mosque]
  );
  const { asr, primary } = settings.faith;
  const place = settings.faith.loc ?? TILFORD;

  const value = useMemo<FaithState>(() => {
    const userId = own.userId;
    const byKey = new Map(logs.map((l) => [`${l.date}|${l.prayer}`, l]));
    const logId = (date: string, p: PrayerId) => stableId(`${userId}:faith:prayer:${date}:${p}`);
    const mosqueFor = (date: string) => mosque.find((m) => m.from <= date) ?? null;
    return {
      // Shared tables wait for a household; prayers don't need one.
      loading: own.loading || (!!householdId && shared.loading),
      error: own.error ?? shared.error,
      householdId,
      logs,
      mosque,
      place,
      asr,
      primary,
      windows: (date) => windowsFor(date, place, asr),
      logFor: (date, p) => byKey.get(`${date}|${p}`),
      mosqueFor,
      mosqueTime(date, p) {
        const m = mosqueFor(date);
        if (!m) return null;
        const key: MosqueKey = p === 'zuhr' && isFriday(date) && m.times.jumuah ? 'jumuah' : p;
        const v = m.times[key];
        if (!v) return null;
        if (v === 'sunset') return calcTimes(date, place, asr).maghrib;
        const [h, min] = v.split(':').map(Number);
        return h * 60 + min;
      },
      async logPrayer(d) {
        const rows = [newVersion(userId!, await logId(d.date, d.prayer), d)];
        // Combined prayers log both at the same time.
        if (d.combined) rows.push(newVersion(userId!, await logId(d.date, d.combined), { ...d, prayer: d.combined, combined: d.prayer }));
        // Un-combining: the partner keeps its log but loses the link.
        const prev = byKey.get(`${d.date}|${d.prayer}`);
        if (prev?.combined && prev.combined !== d.combined) {
          const partner = byKey.get(`${d.date}|${prev.combined}`);
          if (partner) rows.push(newVersion(userId!, partner.id, { ...dataOf(partner), combined: null }));
        }
        await own.append('prayers', rows);
      },
      async removeLog(date, p) {
        const l = byKey.get(`${date}|${p}`);
        if (!l) return;
        const rows = [newVersion(userId!, l.id, dataOf(l), true)];
        const partner = l.combined ? byKey.get(`${date}|${l.combined}`) : undefined;
        if (partner) rows.push(newVersion(userId!, partner.id, { ...dataOf(partner), combined: null }));
        await own.append('prayers', rows);
      },
      async saveMosque(d) {
        if (!householdId) throw new Error('Join or create a household first (More › Household).');
        await shared.append('mosque', [newVersion(shared.userId!, await stableId(`${householdId}:faith:mosque:${d.from}`), d)]);
      }
    };
  }, [own, shared, logs, mosque, householdId, place, asr, primary]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFaith(): FaithState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useFaith must be used inside <FaithProvider>');
  return ctx;
}

