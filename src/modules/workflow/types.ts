import type { Current } from '@/lib/versioned';

export const TABLES = {
  buckets: 'workflow_buckets',
  projects: 'workflow_projects',
  milestones: 'workflow_milestones',
  people: 'workflow_people'
} as const;

export type Priority = 'P1' | 'P2' | 'P3';
export type Status = 'Planning' | 'In progress' | 'Blocked' | 'Done';
export type BucketColor = 'coral' | 'violet' | 'sun' | 'green';

export const PRIORITIES: Priority[] = ['P1', 'P2', 'P3'];
export const STATUSES: Status[] = ['Planning', 'In progress', 'Blocked', 'Done'];
export const BUCKET_COLORS: { id: BucketColor; label: string }[] = [
  { id: 'coral', label: 'Coral' },
  { id: 'violet', label: 'Violet' },
  { id: 'sun', label: 'Sun' },
  { id: 'green', label: 'Green' }
];

export type BucketData = { name: string; color: BucketColor; order: number };
export type ProjectData = {
  bucket_id: string;
  name: string;
  description: string;
  priority: Priority;
  status: Status;
  /** YYYY-MM-DD or null. */
  due: string | null;
  people: string[];
  sample?: boolean;
};
export type MilestoneData = {
  project_id: string;
  title: string;
  owner_id: string | null;
  due: string | null;
  done: boolean;
  /** Date it was ticked off. */
  done_at: string | null;
  order: number;
  sample?: boolean;
};
/** Names only. `me` marks the signed-in person's own entry. */
export type PersonData = { name: string; initials: string; role: string | null; me?: boolean; sample?: boolean };

export type Bucket = Current<BucketData>;
export type Project = Current<ProjectData>;
export type Milestone = Current<MilestoneData>;
export type Person = Current<PersonData>;

export function initialsOf(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || '?'
  );
}
