import { addDays, toISODate } from '@/lib/date';
import { stableId, type Version } from '@/lib/versioned';
import { initialsOf, type BucketData, type MilestoneData, type PersonData, type Priority, type ProjectData, type Status } from './types';

// Starter data: the three buckets, you, and sample people, projects and
// milestones so the screens aren't empty. Ids come from the user id, so
// seeding twice is harmless. Buckets and "you" stay when samples are cleared.

const BUCKETS: [string, string, BucketData['color']][] = [
  ['mka', 'MKA UK', 'coral'],
  ['business', 'Business', 'violet'],
  ['ai', 'AI Side Hustles', 'sun']
];

const PEOPLE: [string, string, string | null][] = [
  ['ayesha', 'Ayesha', 'Volunteer lead'],
  ['omar', 'Omar', 'Designer'],
  ['sam', 'Sam', null]
];

const PROJECTS: [string, string, string, string, Priority, Status, number, string[]][] = [
  ['onboarding', 'mka', 'Q4 client onboarding', 'Bring three new clients through intake before December.', 'P1', 'In progress', 10, ['me', 'ayesha']],
  ['rota', 'mka', 'Volunteer rota', 'November rota for the weekend events.', 'P2', 'Planning', 21, ['me', 'sam']],
  ['pricing', 'business', 'Pricing page rebuild', 'New pricing tiers and copy.', 'P2', 'In progress', 14, ['me', 'omar']],
  ['accounts', 'business', 'Quarterly accounts', 'Q3 books ready for the accountant.', 'P1', 'In progress', 6, ['me']],
  ['video', 'ai', 'Short-form video channel', 'Weekly batches of short history videos.', 'P1', 'In progress', 8, ['me']],
  ['templates', 'ai', 'Automation templates', 'Sellable automation starter kits.', 'P3', 'Planning', 30, ['me']]
];

// [project, title, owner, days from today, done]
const MILESTONES: [string, string, string, number, boolean][] = [
  ['onboarding', 'Agree onboarding checklist', 'ayesha', -6, true],
  ['onboarding', 'Draft welcome pack', 'me', -3, true],
  ['onboarding', 'Sign off process', 'me', 3, false],
  ['onboarding', 'First client kickoff call', 'ayesha', 7, false],
  ['onboarding', 'Collect feedback', 'me', 10, false],
  ['rota', 'List available volunteers', 'sam', -2, false],
  ['rota', 'Draft November rota', 'me', 5, false],
  ['rota', 'Share rota', 'sam', 12, false],
  ['pricing', 'Audit current pricing', 'omar', -8, true],
  ['pricing', 'Draft copy', 'me', 5, false],
  ['pricing', 'Design new layout', 'omar', 9, false],
  ['pricing', 'Launch page', 'me', 14, false],
  ['accounts', 'Gather receipts', 'me', -1, false],
  ['accounts', 'Reconcile bank feed', 'me', 0, false],
  ['accounts', 'Send to accountant', 'me', 6, false],
  ['video', 'Script batch 2', 'me', -5, true],
  ['video', 'Record voiceovers', 'me', -1, false],
  ['video', 'Publish batch 2', 'me', 1, false],
  ['video', 'Review analytics', 'me', 8, false],
  ['templates', 'Pick first template', 'me', 0, false],
  ['templates', 'Write setup guide', 'me', 20, false],
  ['templates', 'Publish templates', 'me', 30, false]
];

export async function buildSeed(userId: string, now = new Date(), myName = '') {
  const id = (key: string) => stableId(`${userId}:workflow:${key}`);
  const at = (i: number) => new Date(now.getTime() + i).toISOString();
  const day = (offset: number) => toISODate(addDays(now, offset));
  const v = async <T,>(key: string, data: T, i: number): Promise<Version<T>> => ({
    id: await id(`${key}:v1`),
    entity_id: await id(key),
    user_id: userId,
    data,
    deleted: false,
    created_at: at(i)
  });

  const buckets = await Promise.all(BUCKETS.map(([k, name, color], i) => v<BucketData>(`bucket:${k}`, { name, color, order: i }, i)));
  const me = myName.trim() || 'Me';
  const people = [
    await v<PersonData>('person:me', { name: me, initials: initialsOf(me), role: null, me: true }, 10),
    ...(await Promise.all(
      PEOPLE.map(([k, name, role], i) => v<PersonData>(`person:${k}`, { name, initials: initialsOf(name), role, sample: true }, 11 + i))
    ))
  ];
  const personId = async (k: string) => id(`person:${k}`);
  const projects = await Promise.all(
    PROJECTS.map(async ([k, b, name, description, priority, status, due, ppl], i) =>
      v<ProjectData>(
        `project:${k}`,
        {
          bucket_id: await id(`bucket:${b}`),
          name,
          description,
          priority,
          status,
          due: day(due),
          people: await Promise.all(ppl.map(personId)),
          sample: true
        },
        20 + i
      )
    )
  );
  const order: Record<string, number> = {};
  const milestones = await Promise.all(
    MILESTONES.map(async ([p, title, owner, due, done], i) => {
      order[p] = (order[p] ?? -1) + 1;
      return v<MilestoneData>(
        `milestone:${i}`,
        {
          project_id: await id(`project:${p}`),
          title,
          owner_id: await personId(owner),
          due: day(due),
          done,
          done_at: done ? day(due) : null,
          order: order[p],
          sample: true
        },
        40 + i
      );
    })
  );
  return { buckets, people, projects, milestones };
}
