import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Both values come from Vercel env vars (or .env.local when developing).
// If either is missing the app runs in demo mode on data kept in this browser.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      })
    : null;

export const isDemo = supabase === null;
