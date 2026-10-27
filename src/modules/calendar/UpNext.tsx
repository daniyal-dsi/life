import { Link } from 'react-router-dom';
import { CalendarClock } from 'lucide-react';
import { EmptyState, SectionTitle } from '@/components/ui';
import { todayISO } from '@/lib/date';
import { WorkflowProvider, useWorkflow } from '@/modules/workflow/store';
import { look, type ChipKey } from './buckets';
import { CalendarProvider, useCalendar } from './store';
import { hhmm, itemsFor } from './time';

// Home's "Up next today": the next three things still to come today.

export default function UpNext() {
  return (
    <WorkflowProvider seed={false}>
      <CalendarProvider>
        <List />
      </CalendarProvider>
    </WorkflowProvider>
  );
}

function List() {
  const { blocks, work, loading } = useCalendar();
  const { buckets } = useWorkflow();
  const n = new Date();
  const now = n.getHours() * 60 + n.getMinutes();
  const items = itemsFor(todayISO(), blocks, work)
    .filter((it) => it.end > now)
    .sort((a, b) => a.start - b.start)
    .slice(0, 3);

  const title = (
    <SectionTitle
      right={
        <Link to="/calendar" className="font-semibold text-ink underline-offset-2 hover:underline">
          Calendar
        </Link>
      }
    >
      Up next today
    </SectionTitle>
  );
  if (loading) return <section>{title}</section>;
  if (!items.length)
    return (
      <section>
        {title}
        <EmptyState icon={CalendarClock} tone="violet" title="Nothing else planned today" body="Plan blocks for your buckets and the gym in Calendar." />
      </section>
    );

  return (
    <section>
      {title}
      <div className="flex flex-col gap-2">
        {items.map((it) => {
          const key: ChipKey = it.type === 'work' ? 'work' : it.block.kind === 'gym' ? 'gym' : `bucket:${it.block.bucket_id}`;
          const l = look(key, buckets);
          const sub = it.type === 'work' ? 'Work hours' : it.block.kind === 'gym' ? it.block.template_name ?? 'Workout' : it.block.task_title ?? 'No task picked';
          return (
            <Link key={it.id} to="/calendar" className="flex items-center gap-3 rounded-card border border-line bg-surface px-3.5 py-3">
              <span className="w-12 shrink-0 font-extrabold tnum">{hhmm(it.start)}</span>
              <span className={`h-9 w-1.5 shrink-0 rounded-full ${l.cls}`} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{l.name}</span>
                <span className="block truncate text-[13px] text-muted">
                  {sub} · until {hhmm(it.end)}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
