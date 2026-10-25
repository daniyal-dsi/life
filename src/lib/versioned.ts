import { appendRows, readRows } from './local';
import { supabase } from './supabase';

// Versioned records: how modules keep editable things (workouts, templates...)
// without ever overwriting a row. Every save adds a new dated version of an
// entity; a delete adds a version with `deleted: true`. The newest version of
// each entity is its current state, and every older version stays as history.
//
// Each versioned table has the same columns:
//   id (version id), entity_id, user_id, data (jsonb), deleted, created_at
// Household-shared tables also have household_id; they are read by household
// and user_id records who saved each version.

export type Version<T> = {
  id: string;
  entity_id: string;
  user_id: string;
  /** Set on household-shared tables. */
  household_id?: string;
  data: T;
  deleted: boolean;
  created_at: string;
};

/** Current state of one entity: its data plus ids and dates. */
export type Current<T> = T & {
  id: string;
  /** When the entity was first saved. */
  created_at: string;
  /** When its newest version was saved. */
  updated_at: string;
};

const PAGE = 1000;

/** Every version in a table for this user (or household), oldest first. */
export async function loadVersions<T>(table: string, userId: string, householdId?: string): Promise<Version<T>[]> {
  if (!supabase)
    return readRows<Version<T>>(table).filter((r) => (householdId ? r.household_id === householdId : r.user_id === userId));
  const out: Version<T>[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select(`id, entity_id, user_id, data, deleted, created_at${householdId ? ', household_id' : ''}`)
      .eq(householdId ? 'household_id' : 'user_id', householdId ?? userId)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...((data ?? []) as unknown as Version<T>[]));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

/** Adds versions whose id is not stored yet; existing rows are never touched. */
export async function appendVersions<T>(
  table: string,
  userId: string,
  versions: Version<T>[],
  householdId?: string
): Promise<number> {
  const rows = versions.map((v) => ({
    id: v.id,
    entity_id: v.entity_id,
    user_id: userId,
    ...(householdId ? { household_id: householdId } : {}),
    data: v.data,
    deleted: !!v.deleted,
    created_at: v.created_at
  }));
  if (!supabase) return appendRows(table, rows);
  let added = 0;
  for (let i = 0; i < rows.length; i += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .upsert(rows.slice(i, i + PAGE), { onConflict: 'id', ignoreDuplicates: true })
      .select('id');
    if (error) throw error;
    added += data?.length ?? 0;
  }
  return added;
}

export function newVersion<T>(
  userId: string,
  entityId: string,
  data: T,
  deleted = false,
  createdAt = new Date().toISOString()
): Version<T> {
  return { id: crypto.randomUUID(), entity_id: entityId, user_id: userId, data, deleted, created_at: createdAt };
}

/** Folds versions into current entities, dropping deleted ones. */
export function currentOf<T>(versions: Version<T>[]): Current<T>[] {
  const first = new Map<string, string>();
  const latest = new Map<string, Version<T>>();
  for (const v of versions) {
    if (!first.has(v.entity_id) || v.created_at < first.get(v.entity_id)!) first.set(v.entity_id, v.created_at);
    const prev = latest.get(v.entity_id);
    if (!prev || v.created_at > prev.created_at || (v.created_at === prev.created_at && v.id > prev.id)) {
      latest.set(v.entity_id, v);
    }
  }
  const out: Current<T>[] = [];
  for (const v of latest.values()) {
    if (v.deleted) continue;
    out.push({ ...v.data, id: v.entity_id, created_at: first.get(v.entity_id)!, updated_at: v.created_at });
  }
  return out;
}

/**
 * Stable UUID derived from a key, so seeding the same starter data twice (two
 * devices, or a reload) produces the same ids and the second insert is skipped.
 */
export async function stableId(key: string): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key)));
  hash[6] = (hash[6] & 0x0f) | 0x50; // version 5-style
  hash[8] = (hash[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = Array.from(hash.slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
