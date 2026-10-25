import { addInboxItems, listInbox, type InboxItem } from './inbox';
import { appendSettingsRows, loadSettingsHistory, type SettingsRow } from './settings';
import { appendVersions, loadVersions, type Version } from './versioned';

// JSON export/import of everything stored so far. Import only adds rows whose
// id is new, so restoring a backup never overwrites anything already stored.
// Each new module adds its versioned tables to VERSIONED_TABLES as it is built.

/** Module tables that use the versioned-records layout (see versioned.ts). */
const VERSIONED_TABLES = [
  'liftlog_exercises',
  'liftlog_templates',
  'liftlog_workouts',
  'fuellog_profile',
  'fuellog_foods',
  'fuellog_entries',
  'fuellog_weights',
  'workflow_buckets',
  'workflow_projects',
  'workflow_milestones',
  'workflow_people'
] as const;

/** Versioned tables shared by the household (exported for, and imported into, your current household). */
const SHARED_TABLES = ['mealprep_ingredients', 'mealprep_meals', 'mealprep_plan', 'mealprep_shopping'] as const;

const APP = 'life-organiser';
const VERSION = 1;

export type Backup = {
  app: typeof APP;
  version: number;
  exported_at: string;
  household: { name: string } | null;
  settings: SettingsRow[];
  inbox: InboxItem[];
  /** Every version of every versioned table, keyed by table name. */
  tables?: Record<string, Version<unknown>[]>;
};

export async function buildBackup(userId: string, household: { id: string; name: string } | null): Promise<Backup> {
  const [settings, inbox, ...versioned] = await Promise.all([
    loadSettingsHistory(userId),
    listInbox(userId, 10000),
    ...VERSIONED_TABLES.map((t) => loadVersions<unknown>(t, userId)),
    ...SHARED_TABLES.map((t) => (household ? loadVersions<unknown>(t, userId, household.id) : Promise.resolve([])))
  ]);
  return {
    app: APP,
    version: VERSION,
    exported_at: new Date().toISOString(),
    household: household ? { name: household.name } : null,
    settings,
    inbox,
    tables: Object.fromEntries([...VERSIONED_TABLES, ...SHARED_TABLES].map((t, i) => [t, versioned[i]]))
  };
}

export function downloadBackup(backup: Backup) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `life-organiser-${backup.exported_at.slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

const isRow = (r: unknown): r is { id: string; created_at: string } =>
  !!r && typeof (r as { id?: unknown }).id === 'string' && typeof (r as { created_at?: unknown }).created_at === 'string';

export async function importBackup(
  text: string,
  userId: string,
  householdId: string | null
): Promise<{ settings: number; inbox: number; records: number }> {
  let parsed: Partial<Backup>;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  if (parsed.app !== APP) throw new Error('That file is not a Life Organiser export.');
  const settings = (Array.isArray(parsed.settings) ? parsed.settings : []).filter(isRow) as SettingsRow[];
  const inbox = (Array.isArray(parsed.inbox) ? parsed.inbox : [])
    .filter(isRow)
    .filter((i) => typeof (i as InboxItem).text === 'string') as InboxItem[];
  let records = 0;
  for (const table of [...VERSIONED_TABLES, ...SHARED_TABLES]) {
    const shared = (SHARED_TABLES as readonly string[]).includes(table);
    if (shared && !householdId) continue;
    const rows = parsed.tables?.[table];
    if (!Array.isArray(rows)) continue;
    const valid = rows.filter(
      (r): r is Version<unknown> =>
        isRow(r) &&
        typeof (r as Version<unknown>).entity_id === 'string' &&
        !!(r as Version<unknown>).data &&
        typeof (r as Version<unknown>).data === 'object'
    );
    records += await appendVersions(table, userId, valid, shared ? householdId! : undefined);
  }
  return {
    settings: await appendSettingsRows(userId, settings),
    inbox: await addInboxItems(userId, inbox),
    records
  };
}
