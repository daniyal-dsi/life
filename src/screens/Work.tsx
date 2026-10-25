import { BriefcaseBusiness } from 'lucide-react';
import { Badge, Card, EmptyState, Header, Page, ProgressBar, SectionTitle } from '@/components/ui';

// Step 1 placeholder. Workflow is step 4.

const BUCKETS = [
  { name: 'MKA UK', bar: 'bg-coral', tone: 'coral' },
  { name: 'Business', bar: 'bg-violet', tone: 'violet' },
  { name: 'AI Side Hustles', bar: 'bg-sun', tone: 'sun' }
] as const;

export default function WorkScreen() {
  return (
    <Page>
      <Header label="Work" title="Workflow" />
      <Card dark className="!p-5">
        <p className="text-[14px] text-hero-muted">Open tasks</p>
        <p className="disp tnum mt-1.5 text-[72px] !tracking-[-0.04em] [text-shadow:var(--glow-violet)]">0</p>
        <p className="mt-1.5 text-[13px] text-hero-muted">across 0 active projects</p>
      </Card>
      <section>
        <SectionTitle>Buckets</SectionTitle>
        <div className="divide-y divide-line rounded-card border border-line bg-surface">
          {BUCKETS.map((b) => (
            <div key={b.name} className="flex items-center gap-3 px-4 py-3">
              <span className={`w-[3px] self-stretch rounded-sm ${b.bar}`} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{b.name}</p>
                <p className="text-[13px] text-muted">0 projects · 0 milestones left</p>
                <div className="mt-2">
                  <ProgressBar value={0} tone={b.tone} label={`${b.name} progress`} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
      <EmptyState
        icon={BriefcaseBusiness}
        tone="violet"
        title="No projects yet"
        body="Projects, milestones, people and due-date reminders arrive in step 4."
        action={
          <div className="flex justify-center gap-2" aria-label="Priority badges">
            <Badge kind="P1" />
            <Badge kind="P2" />
            <Badge kind="P3" />
          </div>
        }
      />
    </Page>
  );
}
