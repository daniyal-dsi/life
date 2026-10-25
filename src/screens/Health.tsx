import { useSearchParams } from 'react-router-dom';
import { Header, Page, UnderlineTabs, type TabItem } from '@/components/ui';
import { formatLong } from '@/lib/date';
import FuelLog from '@/modules/fuellog/FuelLog';
import LiftLog from '@/modules/liftlog/LiftLog';
import MealPrep from '@/modules/mealprep/MealPrep';

// Health: Lift Log (step 2), Fuel Log (step 3) and Meal Prep (step 5).

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
      {tab === 'meal' && <MealPrep />}
    </Page>
  );
}
