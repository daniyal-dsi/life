import { supabase } from '@/lib/supabase';
import type { FoodResult, Portion } from './types';

// USDA FoodData Central, through our own /api/usda function so the API key
// stays on the server. Needs you to be signed in.

async function call(params: string): Promise<Record<string, unknown>> {
  if (!supabase) throw new Error('USDA search needs a Supabase connection.');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in first.');
  const res = await fetch(`/api/usda?${params}`, { headers: { Authorization: `Bearer ${token}` } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? 'USDA search failed.');
  return body;
}

export async function searchUsda(query: string): Promise<FoodResult[]> {
  return ((await call(`q=${encodeURIComponent(query)}`)).foods ?? []) as FoodResult[];
}

/** Household portions for a USDA food (best effort: empty on any failure). */
export async function usdaPortions(fdcId: string): Promise<Portion[]> {
  try {
    return ((await call(`id=${encodeURIComponent(fdcId)}`)).portions ?? []) as Portion[];
  } catch {
    return [];
  }
}

/** Adds USDA portions to a picked result, so grams per unit can be filled in. */
export async function withPortions(r: FoodResult): Promise<FoodResult> {
  if (r.source !== 'USDA' || r.portions) return r;
  return { ...r, portions: await usdaPortions(r.ref) };
}
