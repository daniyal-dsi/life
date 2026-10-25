import { Apple, CookingPot, Dumbbell } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { EmptyState, Header, Page, StatTile, UnderlineTabs, type TabItem } from '@/components/ui';
import { formatLong } from '@/lib/date';

// Step 1 placeholders for the three Health modules (steps 2, 3 and 5).

type Module = 'lift' | 'fuel' | 'meal';

const TABS: TabItem<Module>[] = [
  { id: 'lift', label: 'Lift Log', tone: 'coral' },
  { id: 'fuel', label: 'Fuel Log', tone: 'green' },
  { id: 'meal', label: 'Meal Prep', tone: 'sun' }
];

export default function HealthScreen() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('m');
  const tab: Module = raw === 'fuel' || raw === 'meal' ? raw : 'lift';
  const label = TABS.find((t) => t.id === tab)!.label;

  return (
    <Page>
      <div>
        <Header label={formatLong(new Date())} title={label} />
        <UnderlineTabs tabs={TABS} value={tab} onChange={(m) => setParams({ m }, { replace: true })} />
      </div>

      {tab === 'lift' && (
        <>
          <div className="grid grid-cols-2 gap-2.5">
            <StatTile label="Streak" value="0" unit="weeks" tone="coral" />
            <StatTile label="This week" value="0" unit="kg" tone="coral" />
          </div>
          <EmptyState
            icon={Dumbbell}
            tone="coral"
            title="No workouts yet"
            body="Log workouts, track personal records and keep your streak. Lift Log arrives in step 2."
          />
        </>
      )}
      {tab === 'fuel' && (
        <>
          <div className="grid grid-cols-2 gap-2.5">
            <StatTile label="Left today" value="–" unit="kcal" tone="green" />
            <StatTile label="Protein" value="–" unit="g" tone="green" />
          </div>
          <EmptyState
            icon={Apple}
            tone="green"
            title="No targets yet"
            body="Set your profile to get a daily calorie target, then log what you eat. Fuel Log arrives in step 3."
          />
        </>
      )}
      {tab === 'meal' && (
        <>
          <div className="grid grid-cols-2 gap-2.5">
            <StatTile label="Planned" value="0" unit="of 21" tone="sun" />
            <StatTile label="To buy" value="0" unit="items" tone="sun" />
          </div>
          <EmptyState
            icon={CookingPot}
            tone="sun"
            title="No meals planned"
            body="Plan the week together and get one shared shopping list. Meal Prep arrives in step 5."
          />
        </>
      )}
    </Page>
  );
}
