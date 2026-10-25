import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from './auth';
import { appendRows, newRow, readRows, type Row } from './local';
import { supabase } from './supabase';

export type Household = { id: string; name: string; invite_code: string; created_at: string };
export type Member = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  role: 'owner' | 'member';
  joined_at: string;
};

type HouseholdState = {
  household: Household | null;
  members: Member[];
  loading: boolean;
  error: string | null;
  create: (name: string) => Promise<void>;
  join: (code: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const HouseholdContext = createContext<HouseholdState | null>(null);

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function localInviteCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

/** Demo mode keeps a single household on this device, created on first use. */
function demoHousehold(): Household {
  const rows = readRows<Row & Household>('households');
  if (rows[0]) return rows[0];
  const row = newRow({ name: 'My household', invite_code: localInviteCode() });
  appendRows('households', [row]);
  return row;
}

export function normaliseCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    if (!userId) {
      setHousehold(null);
      setMembers([]);
      setLoading(false);
      return;
    }
    if (!supabase) {
      const h = demoHousehold();
      setHousehold(h);
      setMembers([{ user_id: userId, email: null, display_name: null, role: 'owner', joined_at: h.created_at }]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error: memberErr } = await supabase
        .from('household_members')
        .select('households(id, name, invite_code, created_at)')
        .eq('user_id', userId)
        .is('left_at', null)
        .limit(1)
        .maybeSingle();
      if (memberErr) throw memberErr;
      const h = (data?.households ?? null) as unknown as Household | null;
      setHousehold(h);
      if (h) {
        const { data: roster, error: rosterErr } = await supabase.rpc('household_roster');
        if (rosterErr) throw rosterErr;
        setMembers((roster ?? []) as Member[]);
      } else {
        setMembers([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your household.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(
    async (name: string) => {
      if (!supabase) return refresh();
      const { error: rpcErr } = await supabase.rpc('create_household', { p_name: name });
      if (rpcErr) throw rpcErr;
      await refresh();
    },
    [refresh]
  );

  const join = useCallback(
    async (code: string) => {
      if (!supabase) throw new Error('Joining a household needs a Supabase connection.');
      const { error: rpcErr } = await supabase.rpc('join_household', { p_code: normaliseCode(code) });
      if (rpcErr) throw rpcErr;
      await refresh();
    },
    [refresh]
  );

  return (
    <HouseholdContext.Provider value={{ household, members, loading, error, create, join, refresh }}>
      {children}
    </HouseholdContext.Provider>
  );
}

export function useHousehold(): HouseholdState {
  const ctx = useContext(HouseholdContext);
  if (!ctx) throw new Error('useHousehold must be used inside <HouseholdProvider>');
  return ctx;
}
