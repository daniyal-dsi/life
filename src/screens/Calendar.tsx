import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { EmptyState, Header, Page, Segmented } from '@/components/ui';
import { formatMonth, formatWeekday, isSameDay, weekDays } from '@/lib/date';

// Step 1 placeholder. Day and week planning and the Google Calendar sync are step 6.

export default function CalendarScreen() {
  const today = new Date();
  const [view, setView] = useState<'day' | 'week'>('day');
  const [selected, setSelected] = useState(today);

  return (
    <Page>
      <Header label={formatMonth(selected)} title="Calendar" />
      <Segmented
        label="View"
        options={[
          { id: 'day', label: 'Day' },
          { id: 'week', label: 'Week' }
        ]}
        value={view}
        onChange={setView}
      />
      <div className="grid grid-cols-7 gap-1.5">
        {weekDays(today).map((d) => {
          const active = isSameDay(d, selected);
          return (
            <button
              key={d.toISOString()}
              type="button"
              aria-pressed={active}
              onClick={() => setSelected(d)}
              className={`flex flex-col items-center gap-0.5 rounded-btn border py-2 ${
                active ? 'border-ink bg-ink text-bg' : 'border-line bg-surface'
              }`}
            >
              <span className={`text-[11px] font-semibold ${active ? 'text-hero-muted' : 'text-muted'}`}>
                {formatWeekday(d)}
              </span>
              <b className="font-display text-[17px]">{d.getDate()}</b>
            </button>
          );
        })}
      </div>
      <EmptyState
        icon={CalendarDays}
        tone="violet"
        title={view === 'day' ? 'No blocks today' : 'No blocks this week'}
        body="Drag bucket blocks onto your day and sync with Google Calendar. This arrives in step 6."
      />
    </Page>
  );
}
