// Demo-mode storage. Every table is an append-only list of dated rows in
// localStorage; rows are added, never edited or removed.

export type Row = { id: string; created_at: string; [key: string]: unknown };

const key = (table: string) => `lo:${table}`;

export function readRows<T extends Row>(table: string): T[] {
  try {
    const raw = localStorage.getItem(key(table));
    const rows = raw ? (JSON.parse(raw) as T[]) : [];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

/** Adds rows whose id is not already stored. Returns how many were added. */
export function appendRows<T extends Row>(table: string, rows: T[]): number {
  const existing = readRows<T>(table);
  const seen = new Set(existing.map((r) => r.id));
  const fresh = rows.filter((r) => r && typeof r.id === 'string' && !seen.has(r.id));
  if (fresh.length === 0) return 0;
  const next = [...existing, ...fresh].sort((a, b) => a.created_at.localeCompare(b.created_at));
  try {
    localStorage.setItem(key(table), JSON.stringify(next));
  } catch {
    return 0;
  }
  return fresh.length;
}

export function newRow<T extends object>(data: T): T & { id: string; created_at: string } {
  return { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...data };
}

export const DEMO_USER_ID = 'demo-user';
