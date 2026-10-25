import { Navigate, Route, Routes } from 'react-router-dom';
import { WifiOff } from 'lucide-react';
import { areas } from '@/areas';
import { SideBar, TabBar } from '@/components/TabBar';
import { useAuth } from '@/lib/auth';
import { HouseholdProvider, useHousehold } from '@/lib/household';
import HouseholdSetup from '@/screens/HouseholdSetup';
import SignIn from '@/screens/SignIn';

function Splash() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center">
      <p className="disp text-[22px] text-muted">Life Organiser</p>
    </div>
  );
}

function NotConnectedBanner() {
  return (
    <div
      role="status"
      className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-sun-soft px-4 pb-2 pt-[max(8px,env(safe-area-inset-top))] text-[13px] font-semibold text-sun-ink"
    >
      <WifiOff size={14} strokeWidth={2.4} aria-hidden />
      Not connected: demo mode, data stays on this device
    </div>
  );
}

function Shell() {
  const { demo } = useAuth();
  return (
    <div className="lg:pl-[232px]">
      {demo && <NotConnectedBanner />}
      <SideBar />
      <main className={`mx-auto max-w-app lg:max-w-[720px] ${demo ? '' : 'pt-[env(safe-area-inset-top)]'}`}>
        <Routes>
          {areas.map(({ id, path, Screen }) => (
            <Route key={id} path={path === '/' ? '/' : `${path}/*`} element={<Screen />} />
          ))}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <TabBar />
    </div>
  );
}

function HouseholdGate() {
  const { household, loading, error } = useHousehold();
  if (loading) return <Splash />;
  if (!household) return <HouseholdSetup loadError={error} />;
  return <Shell />;
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (!user) return <SignIn />;
  return (
    <HouseholdProvider>
      <HouseholdGate />
    </HouseholdProvider>
  );
}
