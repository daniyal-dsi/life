import { CookingPot } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { EmptyState, Header, Page, StatTile, UnderlineTabs, type TabItem } from '@/components/ui';
import { formatLong } from '@/lib/date';
import FuelLog from '@/modules/fuellog/FuelLog';
import LiftLog from '@/modules/liftlog/LiftLog';

// Health: Lift Log (step 2) and Fuel Log (step 3); Meal Prep (step 5) is still a placeholder.

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

      {tab === 'lift' && <LiftLog />}
      {tab === 'fuel' && <FuelLog />}
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
