import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Both values come from Vercel env vars (or .env.local when developing): our
// own VITE_* names, or the NEXT_PUBLIC_* ones the Vercel-Supabase integration
// adds. If either is missing the app runs in demo mode on data kept in this browser.
// (Direct import.meta.env.* references let Vite drop Supabase from keyless builds.)
const url = (import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL) as string | undefined;
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) as string | undefined;

export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      })
    : null;

export const isDemo = supabase === null;
