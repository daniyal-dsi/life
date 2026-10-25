import { createContext, createElement, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from './auth';
import { appendRows, newRow, readRows, type Row } from './local';
import { supabase } from './supabase';

// Settings are append-only: every change adds a new dated row, and the newest
// row wins. Nothing is updated in place.

export type Theme = 'light' | 'dark' | 'system';
/** Which reminders to send (UK times). Matches supabase/functions/_shared/reminders.ts. */
export type ReminderPrefs = { daily: boolean; p1: boolean; overdue: boolean; weekly: boolean; nudges: boolean };
export type Settings = { name: string; theme: Theme; reminders: ReminderPrefs };
export type SettingsRow = Row & { data: Settings };

export const DEFAULT_REMINDERS: ReminderPrefs = { daily: true, p1: true, overdue: true, weekly: true, nudges: true };
export const DEFAULT_SETTINGS: Settings = { name: '', theme: 'system', reminders: DEFAULT_REMINDERS };

const THEME_CACHE = 'lo:theme';

function systemPrefersDark(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

export function isDarkTheme(theme: Theme): boolean {
  return theme === 'dark' || (theme === 'system' && systemPrefersDark());
}

export function applyTheme(theme: Theme) {
  const dark = isDarkTheme(theme);
  document.documentElement.classList.toggle('theme-dark', dark);
  try {
    localStorage.setItem(THEME_CACHE, theme);
  } catch {
    /* storage unavailable */
  }
}

// Apply the last-used theme before the first render so there is no flash.
try {
  applyTheme((localStorage.getItem(THEME_CACHE) as Theme | null) ?? 'system');
} catch {
  applyTheme('system');
}

function normalise(data: Partial<Settings> | null | undefined): Settings {
  const theme = data?.theme === 'light' || data?.theme === 'dark' ? data.theme : 'system';
  const r = (data?.reminders ?? {}) as Partial<ReminderPrefs>;
  const reminders = Object.fromEntries(
    (Object.keys(DEFAULT_REMINDERS) as (keyof ReminderPrefs)[]).map((k) => [k, typeof r[k] === 'boolean' ? r[k] : DEFAULT_REMINDERS[k]])
  ) as ReminderPrefs;
  return { name: typeof data?.name === 'string' ? data.name : '', theme, reminders };
}

export async function loadSettingsHistory(userId: string): Promise<SettingsRow[]> {
  if (!supabase) return readRows<SettingsRow>('settings');
  const { data, error } = await supabase
    .from('settings')
    .select('id, created_at, data')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as SettingsRow[];
}

/** Adds rows whose id is not stored yet; existing rows are left alone. */
export async function appendSettingsRows(userId: string, rows: SettingsRow[]): Promise<number> {
  if (!supabase) return appendRows('settings', rows);
  if (rows.length === 0) return 0;
  const { data, error } = await supabase
    .from('settings')
    .upsert(
      rows.map((r) => ({ id: r.id, created_at: r.created_at, user_id: userId, data: normalise(r.data) })),
      { onConflict: 'id', ignoreDuplicates: true }
    )
    .select('id');
  if (error) throw error;
  return data?.length ?? 0;
}

type SettingsState = {
  settings: Settings;
  loading: boolean;
  update: (patch: Partial<Settings>) => Promise<void>;
  reload: () => Promise<void>;
};

const SettingsContext = createContext<SettingsState | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!userId) {
      setSettings(DEFAULT_SETTINGS);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const history = await loadSettingsHistory(userId);
      const latest = history[history.length - 1];
      if (latest) setSettings(normalise(latest.data));
    } catch (err) {
      console.error('Could not load settings', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    applyTheme(settings.theme);
    if (settings.theme !== 'system') return;
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq?.addEventListener('change', onChange);
    return () => mq?.removeEventListener('change', onChange);
  }, [settings.theme]);

  const update = useCallback(
    async (patch: Partial<Settings>) => {
      const next = normalise({ ...settings, ...patch });
      setSettings(next);
      if (!userId) return;
      await appendSettingsRows(userId, [newRow({ data: next })]);
    },
    [settings, userId]
  );

  return createElement(SettingsContext.Provider, { value: { settings, loading, update, reload } }, children);
}

export function useSettings(): SettingsState {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>');
  return ctx;
}
