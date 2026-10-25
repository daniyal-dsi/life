import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useHousehold } from '@/lib/household';
import { useSettings } from '@/lib/settings';
import { loadVersions, type Version } from '@/lib/versioned';
import { profileOn, targets, type Targets } from '@/modules/fuellog/targets';
import type { ProfileData } from '@/modules/fuellog/types';

/** Household members who can eat a planned meal, with display names. */
export function useEaters(): { id: string; name: string; me: boolean }[] {
  const { user } = useAuth();
  const { members } = useHousehold();
  const { settings } = useSettings();
  return members.map((m) => {
    const me = m.user_id === user?.id;
    return { id: m.user_id, me, name: (me ? settings.name : null) || m.display_name || m.email?.split('@')[0] || (me ? 'You' : 'Member') };
  });
}

/** Your Fuel Log targets for today, or null if you haven't set a profile. */
export function useMyTargets(): Targets | null {
  const { user } = useAuth();
  const [t, setT] = useState<Targets | null>(null);
  useEffect(() => {
    if (!user) return;
    loadVersions<ProfileData>('fuellog_profile', user.id)
      .then((v: Version<ProfileData>[]) => {
        const today = new Date();
        const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const p = profileOn(v, iso);
        setT(p ? targets(p) : null);
      })
      .catch(() => setT(null));
  }, [user]);
  return t;
}
