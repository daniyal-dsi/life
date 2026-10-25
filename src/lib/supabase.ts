import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Both values come from Vercel env vars (or .env.local when developing): our
// own VITE_* names, or the NEXT_PUBLIC_* ones the Vercel-Supabase integration
// adds. If either is missing the app runs in demo mode on data kept in this browser.
const env = import.meta.env;
const url = (env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL) as string | undefined;
const anonKey = (env.VITE_SUPABASE_ANON_KEY ||
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) as string | undefined;

export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      })
    : null;

export const isDemo = supabase === null;
