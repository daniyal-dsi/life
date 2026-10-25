import { supabase } from '@/lib/supabase';
import type { FoodResult } from './types';

// USDA FoodData Central, through our own /api/usda function so the API key
// stays on the server. Needs you to be signed in.

export async function searchUsda(query: string): Promise<FoodResult[]> {
  if (!supabase) throw new Error('USDA search needs a Supabase connection.');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in first.');
  const res = await fetch(`/api/usda?q=${encodeURIComponent(query)}`, { headers: { Authorization: `Bearer ${token}` } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? 'USDA search failed.');
  return (body.foods ?? []) as FoodResult[];
}
