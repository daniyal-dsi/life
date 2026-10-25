import { appendRows, newRow, readRows, type Row } from './local';
import { supabase } from './supabase';

// Personal inbox: messages sent in from outside the app (the iPhone Shortcut
// in a later step). Items are kept; `used_for` records what a message became.

export type InboxItem = Row & { user_id: string; text: string; source: string; used_for: string | null };

export async function listInbox(userId: string, limit = 50): Promise<InboxItem[]> {
  if (!supabase) {
    return readRows<InboxItem>('inbox')
      .filter((i) => i.user_id === userId)
      .reverse()
      .slice(0, limit);
  }
  const { data, error } = await supabase
    .from('inbox')
    .select('id, created_at, user_id, text, source, used_for')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as InboxItem[];
}

/** Adds items whose id is not stored yet; existing items are left alone. */
export async function addInboxItems(userId: string, items: InboxItem[]): Promise<number> {
  const rows = items.map((i) => ({
    id: i.id,
    created_at: i.created_at,
    user_id: userId,
    text: String(i.text).slice(0, 10_000),
    source: typeof i.source === 'string' ? i.source : 'import',
    used_for: typeof i.used_for === 'string' ? i.used_for : null
  }));
  if (!supabase) return appendRows('inbox', rows);
  if (rows.length === 0) return 0;
  const { data, error } = await supabase
    .from('inbox')
    .upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
    .select('id');
  if (error) throw error;
  return data?.length ?? 0;
}

export async function addToInbox(userId: string, text: string, source = 'app'): Promise<InboxItem> {
  const item = newRow({ user_id: userId, text: text.trim(), source, used_for: null });
  await addInboxItems(userId, [item]);
  return item;
}
