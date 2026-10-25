// Names that are too vague to shop for or look up. Saving one is blocked
// until it is made specific; imported ones carry a "Type?" flag instead.

export const VAGUE: Record<string, string[]> = {
  chicken: ['Chicken breast', 'Chicken thigh'],
  beef: ['Beef mince (5% fat)', 'Beef steak'],
  lamb: ['Lamb leg', 'Lamb mince'],
  mince: ['Beef mince (5% fat)', 'Turkey mince', 'Lamb mince'],
  fish: ['Salmon fillet', 'Cod fillet'],
  veg: ['Mixed veg (frozen)', 'Broccoli', 'Green beans'],
  vegetables: ['Mixed veg (frozen)', 'Broccoli', 'Green beans'],
  veggies: ['Mixed veg (frozen)', 'Broccoli', 'Green beans'],
  pasta: ['Penne', 'Wholewheat spaghetti'],
  rice: ['Basmati rice', 'Brown rice'],
  cheese: ['Cheddar', 'Feta', 'Parmesan'],
  yoghurt: ['Greek yoghurt 0% fat', 'Natural yoghurt'],
  yogurt: ['Greek yoghurt 0% fat', 'Natural yoghurt'],
  milk: ['Semi-skimmed milk', 'Oat milk'],
  tuna: ['Tuna in brine', 'Tuna in spring water', 'Tuna in oil'],
  'greek yoghurt': ['Greek yoghurt 0% fat', 'Greek yoghurt 2% fat', 'Greek yoghurt full fat']
};

/** Words blocked when typed as a new name ("Tuna" and "Greek yoghurt" are only flagged on import). */
const BLOCKED = new Set(['chicken', 'beef', 'lamb', 'mince', 'fish', 'veg', 'vegetables', 'veggies', 'pasta', 'rice', 'cheese', 'yoghurt', 'yogurt', 'milk']);

export function vagueMessage(name: string): string | null {
  const k = name.trim().toLowerCase();
  if (!BLOCKED.has(k)) return null;
  return `Which type of ${k}? Name it exactly, for example ${VAGUE[k].slice(0, 2).join(' or ')}.`;
}

export function suggestionsFor(name: string): string[] {
  return VAGUE[name.trim().toLowerCase()] ?? [];
}
