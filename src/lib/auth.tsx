import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { DEMO_USER_ID } from './local';
import { isDemo, supabase } from './supabase';

export type AppUser = { id: string; email: string | null };

type AuthState = {
  user: AppUser | null;
  loading: boolean;
  demo: boolean;
  /** Emails a magic link (which also carries a 6-digit code). */
  sendMagicLink: (email: string) => Promise<void>;
  /** Signs in with the 6-digit code, for the home-screen app where links open in Safari. */
  verifyCode: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

const DEMO_USER: AppUser = { id: DEMO_USER_ID, email: null };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!isDemo);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user: isDemo ? DEMO_USER : session ? { id: session.user.id, email: session.user.email ?? null } : null,
      loading,
      demo: isDemo,
      async sendMagicLink(email) {
        if (!supabase) throw new Error('Not connected to Supabase.');
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: { emailRedirectTo: window.location.origin }
        });
        if (error) throw error;
      },
      async verifyCode(email, code) {
        if (!supabase) throw new Error('Not connected to Supabase.');
        const { error } = await supabase.auth.verifyOtp({
          email: email.trim(),
          token: code.replace(/\s/g, ''),
          type: 'email'
        });
        if (error) throw error;
      },
      async signOut() {
        if (supabase) await supabase.auth.signOut();
      }
    }),
    [session, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
