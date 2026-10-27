import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { dataOf, useVersionedTables } from '@/lib/useVersioned';
import { currentOf, newVersion, stableId, type Version } from '@/lib/versioned';
import { TABLES, type Block, type BlockData, type WorkData, type WorkRow } from './types';

type CalendarState = {
  loading: boolean;
  error: string | null;
  blocks: Block[];
  work: WorkRow[];
  saveBlock: (d: BlockData, id?: string) => Promise<string>;
  deleteBlock: (id: string) => Promise<void>;
  /** Hours for one date (also adds work on a weekend). */
  setWorkDay: (date: string, start: number, end: number) => Promise<void>;
  /** Not working on a date. */
  workOff: (date: string) => Promise<void>;
  setUsualHours: (start: number, end: number) => Promise<void>;
  /** Removes a date's own hours, so it follows the usual hours again. */
  clearWorkDay: (date: string) => Promise<void>;
};

const Ctx = createContext<CalendarState | null>(null);
const OPTIONS = { needsSeed: () => false, seed: async () => ({}) };

export function CalendarProvider({ children }: { children: ReactNode }) {
  const { userId, versions, loading, error, append } = useVersionedTables(TABLES, OPTIONS);
  const blocks = useMemo(() => currentOf(versions.blocks as Version<BlockData>[]), [versions.blocks]);
  const work = useMemo(() => currentOf(versions.work as Version<WorkData>[]), [versions.work]);

  const value = useMemo<CalendarState>(() => {
    const ver = (id: string, data: unknown, deleted = false) => newVersion(userId!, id, data, deleted);
    // Work rows have ids derived from what they are, so a day is only ever one entity.
    const dayId = (date: string) => stableId(`${userId}:calendar:work:${date}`);
    return {
      loading,
      error,
      blocks,
      work,
      async saveBlock(d, id) {
        const entityId = id ?? crypto.randomUUID();
        await append('blocks', [ver(entityId, d)]);
        return entityId;
      },
      async deleteBlock(id) {
        const b = blocks.find((x) => x.id === id);
        if (b) await append('blocks', [ver(id, dataOf(b), true)]);
      },
      async setWorkDay(date, start, end) {
        await append('work', [ver(await dayId(date), { kind: 'day', date, start_min: start, end_min: end, off: false } satisfies WorkData)]);
      },
      async workOff(date) {
        await append('work', [ver(await dayId(date), { kind: 'day', date, start_min: 0, end_min: 0, off: true } satisfies WorkData)]);
      },
      async clearWorkDay(date) {
        const row = work.find((r) => r.kind === 'day' && r.date === date);
        if (row) await append('work', [ver(row.id, dataOf(row), true)]);
      },
      async setUsualHours(start, end) {
        await append('work', [ver(await stableId(`${userId}:calendar:work:usual`), { kind: 'usual', start_min: start, end_min: end } satisfies WorkData)]);
      }
    };
  }, [loading, error, blocks, work, append, userId]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCalendar(): CalendarState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCalendar must be used inside <CalendarProvider>');
  return ctx;
}

export function useOptionalCalendar(): CalendarState | null {
  return useContext(Ctx);
}
