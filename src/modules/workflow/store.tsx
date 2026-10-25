import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { todayISO } from '@/lib/date';
import { useSettings } from '@/lib/settings';
import { dataOf, useVersionedTables } from '@/lib/useVersioned';
import { currentOf, newVersion, type Current, type Version } from '@/lib/versioned';
import { buildSeed } from './seed';
import { byOrder } from './stats';
import {
  TABLES,
  type Bucket,
  type BucketData,
  type Milestone,
  type MilestoneData,
  type Person,
  type PersonData,
  type Project,
  type ProjectData
} from './types';

type Key = keyof typeof TABLES;

type WorkflowState = {
  loading: boolean;
  error: string | null;
  buckets: Bucket[];
  projects: Project[];
  milestones: Milestone[];
  people: Person[];
  me: Person | null;
  hasSample: boolean;
  saveBucket: (d: BucketData, id?: string) => Promise<string>;
  deleteBucket: (id: string) => Promise<void>;
  saveProject: (d: ProjectData, id?: string) => Promise<string>;
  /** Deletes the project and its milestones. */
  deleteProject: (id: string) => Promise<void>;
  saveMilestone: (d: MilestoneData, id?: string) => Promise<string>;
  deleteMilestone: (id: string) => Promise<void>;
  toggleMilestone: (id: string) => Promise<void>;
  /** Saves a new order for a project's milestones (only the ones that moved). */
  reorderMilestones: (orderedIds: string[]) => Promise<void>;
  savePerson: (d: PersonData, id?: string) => Promise<string>;
  deletePerson: (id: string) => Promise<void>;
  clearSample: () => Promise<void>;
};

const Ctx = createContext<WorkflowState | null>(null);

export function WorkflowProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const options = useMemo(
    () => ({
      needsSeed: (v: Record<Key, Version<unknown>[]>) => v.buckets.length === 0,
      seed: (uid: string) => buildSeed(uid, new Date(), settings.name)
    }),
    [settings.name]
  );
  const { userId, versions, loading, error, append } = useVersionedTables(TABLES, options);

  const buckets = useMemo(
    () => currentOf(versions.buckets as Version<BucketData>[]).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)),
    [versions.buckets]
  );
  const projects = useMemo(() => currentOf(versions.projects as Version<ProjectData>[]), [versions.projects]);
  const milestones = useMemo(() => currentOf(versions.milestones as Version<MilestoneData>[]), [versions.milestones]);
  const people = useMemo(
    () => currentOf(versions.people as Version<PersonData>[]).sort((a, b) => Number(!!b.me) - Number(!!a.me) || a.name.localeCompare(b.name)),
    [versions.people]
  );

  const value = useMemo<WorkflowState>(() => {
    const version = (id: string, data: unknown, deleted = false) => newVersion(userId!, id, data, deleted);
    const save =
      <T,>(key: Key) =>
      async (data: T, id?: string) => {
        const entityId = id ?? crypto.randomUUID();
        await append(key, [version(entityId, data)]);
        return entityId;
      };
    const tombstones = (list: Current<object>[]) => list.map((x) => version(x.id, dataOf(x), true));
    const find = <T,>(list: Current<T>[], id: string) => list.find((x) => x.id === id);
    return {
      loading,
      error,
      buckets,
      projects,
      milestones,
      people,
      me: people.find((p) => p.me) ?? null,
      hasSample: projects.some((p) => p.sample) || milestones.some((m) => m.sample) || people.some((p) => p.sample),
      saveBucket: save<BucketData>('buckets'),
      async deleteBucket(id) {
        const b = find(buckets, id);
        if (!b) return;
        if (projects.some((p) => p.bucket_id === id)) throw new Error('Move or delete its projects first.');
        await append('buckets', tombstones([b]));
      },
      saveProject: save<ProjectData>('projects'),
      async deleteProject(id) {
        const p = find(projects, id);
        if (!p) return;
        await append('milestones', tombstones(milestones.filter((m) => m.project_id === id)));
        await append('projects', tombstones([p]));
      },
      saveMilestone: save<MilestoneData>('milestones'),
      async deleteMilestone(id) {
        const m = find(milestones, id);
        if (m) await append('milestones', tombstones([m]));
      },
      async toggleMilestone(id) {
        const m = find(milestones, id);
        if (!m) return;
        const d = dataOf<MilestoneData>(m);
        await append('milestones', [version(id, { ...d, done: !d.done, done_at: d.done ? null : todayISO() })]);
      },
      async reorderMilestones(orderedIds) {
        const changed = orderedIds
          .map((id, order) => ({ m: find(milestones, id), order }))
          .filter((x): x is { m: Milestone; order: number } => !!x.m && x.m.order !== x.order);
        await append(
          'milestones',
          changed.map(({ m, order }) => version(m.id, { ...dataOf<MilestoneData>(m), order }))
        );
      },
      savePerson: save<PersonData>('people'),
      async deletePerson(id) {
        const p = find(people, id);
        if (p && !p.me) await append('people', tombstones([p]));
      },
      async clearSample() {
        // Includes milestones you added to a sample project, which goes with it.
        const sampleProjects = new Set(projects.filter((p) => p.sample).map((p) => p.id));
        await append('milestones', tombstones(milestones.filter((m) => m.sample || sampleProjects.has(m.project_id))));
        await append('projects', tombstones(projects.filter((p) => p.sample)));
        await append('people', tombstones(people.filter((p) => p.sample)));
      }
    };
  }, [loading, error, buckets, projects, milestones, people, append, userId]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkflow(): WorkflowState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useWorkflow must be used inside <WorkflowProvider>');
  return ctx;
}

/** Milestones of a project in order. */
export function projectMilestones(milestones: Milestone[], projectId: string): Milestone[] {
  return milestones.filter((m) => m.project_id === projectId).sort(byOrder);
}
