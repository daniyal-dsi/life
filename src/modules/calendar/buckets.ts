import { BriefcaseBusiness, Dumbbell, Folder, type LucideIcon } from 'lucide-react';
import type { Bucket } from '@/modules/workflow/types';

// What each kind of block looks like: Work dark, Gym coral (Lift Log),
// Workflow buckets in their own colour.

export type ChipKey = 'work' | 'gym' | `bucket:${string}`;
export type Look = { name: string; cls: string; icon: LucideIcon };

export const WORK_CLS = 'kcard cb-work';
const KCLS: Record<string, string> = { coral: 'kcard k-coral', violet: 'kcard k-violet', sun: 'kcard k-sun', green: 'kcard k-green' };

export function look(key: ChipKey, buckets: Bucket[]): Look {
  if (key === 'work') return { name: 'Work', cls: WORK_CLS, icon: BriefcaseBusiness };
  if (key === 'gym') return { name: 'Gym', cls: KCLS.coral, icon: Dumbbell };
  const b = buckets.find((x) => x.id === key.slice(7));
  return b ? { name: b.name, cls: KCLS[b.color] ?? KCLS.violet, icon: Folder } : { name: 'Removed bucket', cls: 'bg-chip text-ink border border-line2', icon: Folder };
}

export const chipKeys = (buckets: Bucket[]): ChipKey[] => ['work', 'gym', ...buckets.map((b) => `bucket:${b.id}` as ChipKey)];
