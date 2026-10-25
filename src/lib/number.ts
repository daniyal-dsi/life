/** Parses a typed number, accepting a comma decimal ("82,5"). Blank gives NaN. */
export function parseDecimal(s: string): number {
  return s.trim() === '' ? NaN : Number(s.trim().replace(',', '.'));
}

/** 92.5 -> "92.5", 90 -> "90" (at most one decimal). */
export function oneDp(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}
