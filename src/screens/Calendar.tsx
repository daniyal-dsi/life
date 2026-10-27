import Calendar from '@/modules/calendar/Calendar';
import { CalendarProvider } from '@/modules/calendar/store';
import { LiftLogProvider } from '@/modules/liftlog/store';
import { WorkflowProvider } from '@/modules/workflow/store';

// The planner reads Workflow buckets and tasks and Lift Log templates, without
// seeding either module's sample data.
export default function CalendarScreen() {
  return (
    <WorkflowProvider seed={false}>
      <LiftLogProvider seed={false}>
        <CalendarProvider>
          <Calendar />
        </CalendarProvider>
      </LiftLogProvider>
    </WorkflowProvider>
  );
}
