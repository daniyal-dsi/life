import { Link } from 'react-router-dom';
import { Apple, BriefcaseBusiness, CalendarClock, ChevronRight, CookingPot, Dumbbell, Moon, Plus, Sun } from 'lucide-react';
import { extraAreas } from '@/areas';
import { Button, Card, EmptyState, Header, IconButton, ModuleCard, Page, SectionTitle } from '@/components/ui';
import { useState } from 'react';
import { formatLong, greeting, todayISO } from '@/lib/date';
import FoodSheet, { type FoodDraft } from '@/modules/fuellog/FoodSheet';
import { FuelLogProvider } from '@/modules/fuellog/store';
import type { Meal } from '@/modules/fuellog/types';
import { MealPrepProvider } from '@/modules/mealprep/store';
import { isDarkTheme, useSettings } from '@/lib/settings';

// Step 1 placeholder. The numbers fill in as each module is built (Home is step 8).

function GlanceStat({ to, value, label, className }: { to: string; value: string; label: string; className: string }) {
  return (
    <Link to={to} className="min-w-0 text-left [&+&]:border-l [&+&]:border-white/10 [&+&]:pl-3">
      <span className={`disp tnum block text-[40px] ${className}`}>{value}</span>
      <span className="mt-2 block text-[13px] text-hero-muted">{label}</span>
    </Link>
  );
}

/** Mealtime for "now": breakfast before 11, lunch before 15, dinner before 21, else snacks. */
function mealNow(): Meal {
  const h = new Date().getHours();
  return h < 11 ? 'breakfast' : h < 15 ? 'lunch' : h < 21 ? 'dinner' : 'snacks';
}

export default function HomeScreen() {
  const { settings, update } = useSettings();
  const [logFood, setLogFood] = useState<FoodDraft | null>(null);
  const now = new Date();
  const dark = isDarkTheme(settings.theme);

  return (
    <Page>
      <Header
        label={formatLong(now)}
        title={`${greeting(now)}${settings.name ? `, ${settings.name}` : ''}`}
        right={
          <IconButton
            icon={dark ? Sun : Moon}
            label={`Switch to ${dark ? 'light' : 'dark'} theme`}
            onClick={() => void update({ theme: dark ? 'light' : 'dark' })}
          />
        }
      />

      <Card dark className="!p-5">
        <p className="text-[14px] text-hero-muted">Today at a glance</p>
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          <GlanceStat to="/health" value="0" label="week lift streak" className="text-coral [text-shadow:var(--glow-coral)]" />
          <GlanceStat to="/health" value="–" label="kcal left today" className="text-green-hi [text-shadow:var(--glow-green)]" />
          <GlanceStat to="/work" value="0" label="P1 due this week" className="text-violet-hi [text-shadow:var(--glow-violet)]" />
        </div>
      </Card>

      <Button variant="green" icon={Plus} onClick={() => setLogFood({ date: todayISO(), meal: mealNow() })}>
        Log a food
      </Button>
      {logFood && (
        // Loaded only when needed; the same sheet as the Fuel Log, without seeding sample data.
        <FuelLogProvider seed={false}>
          <MealPrepProvider>
            <FoodSheet draft={logFood} onClose={() => setLogFood(null)} />
          </MealPrepProvider>
        </FuelLogProvider>
      )}

      <section>
        <SectionTitle right="Calendar">Up next</SectionTitle>
        <EmptyState
          icon={CalendarClock}
          tone="violet"
          title="Nothing planned yet"
          body="Your next three blocks and Google Calendar events will show here once Calendar is built."
        />
      </section>

      <section>
        <SectionTitle>Your areas</SectionTitle>
        <div className="grid grid-cols-2 gap-2.5">
          <ModuleCard to="/health" tone="coral" icon={Dumbbell} title="Lift Log" value="0" unit="weeks" progress={0} caption="0 of 3 this week" />
          <ModuleCard to="/health" tone="green" icon={Apple} title="Fuel Log" value="–" unit="kcal left" progress={0} caption="Set up your targets" />
          <ModuleCard to="/health" tone="sun" icon={CookingPot} title="Meal Prep" value="0" unit="of 21" progress={0} caption="0 items to buy" />
          <ModuleCard to="/work" tone="violet" icon={BriefcaseBusiness} title="Workflow" value="0" unit="open" progress={0} caption="0 × P1 · 0 projects" />
        </div>
      </section>

      <Link
        to="/faith"
        className="flex items-center gap-3 rounded-card border border-gold bg-faith p-4 text-niche"
      >
        <Moon size={20} className="text-gold-hi" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block font-bold">Faith</span>
          <span className="block text-[13px] opacity-80">Next prayer and today's on-time count arrive in step 7</span>
        </span>
        <ChevronRight size={18} aria-hidden />
      </Link>

      <section>
        <SectionTitle>Coming next</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {extraAreas.map((a) => (
            <Link
              key={a.id}
              to={a.path}
              className="inline-flex h-[38px] items-center gap-1.5 rounded-ctl border-[1.5px] border-line2 px-4 text-[14px] font-semibold"
            >
              <a.icon size={14} aria-hidden />
              {a.label}
            </Link>
          ))}
          {['Finance', 'Learning', 'Personal']
            .filter((name) => !extraAreas.some((a) => a.label === name))
            .map((name) => (
              <span
                key={name}
                className="inline-flex h-[38px] items-center gap-1.5 rounded-ctl border-[1.5px] border-dashed border-line2 px-4 text-[14px] font-semibold text-muted"
              >
                <Plus size={14} aria-hidden />
                {name}
              </span>
            ))}
        </div>
      </section>
    </Page>
  );
}
