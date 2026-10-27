import type { Current } from '@/lib/versioned';

export const TABLES = { blocks: 'calendar_blocks', work: 'calendar_work' } as const;

/** Timeline shown: 06:00 to 23:00. */
export const CAL_START = 6;
export const CAL_END = 23;

/**
 * A planned block. Bucket blocks may name a Workflow task (copied title, so it
 * still reads after the task changes); gym blocks name a Lift Log template.
 * google_event_id is filled by the Google sync (step 6b).
 */
export type BlockData = {
  date: string;
  start_min: number;
  end_min: number;
  kind: 'bucket' | 'gym';
  bucket_id: string | null;
  task_id: string | null;
  task_title: string | null;
  template_id: string | null;
  template_name: string | null;
  google_event_id: string | null;
};

/**
 * Work hours. One "usual" entity (Monday to Friday), plus one entity per date
 * that differs: other hours, not working, or work on a weekend.
 */
export type WorkData =
  | { kind: 'usual'; start_min: number; end_min: number }
  | { kind: 'day'; date: string; start_min: number; end_min: number; off: boolean };

export type Block = Current<BlockData>;
export type WorkRow = Current<WorkData>;

/** One thing on the timeline: a stored block or the day's work hours. */
export type Item =
  | { type: 'block'; id: string; date: string; start: number; end: number; block: Block }
  | { type: 'work'; id: string; date: string; start: number; end: number };

export const DEFAULT_WORK = { start_min: 9 * 60, end_min: 17 * 60 };
