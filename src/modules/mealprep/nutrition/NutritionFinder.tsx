import { useEffect, useState, type FormEvent } from 'react';
import { BottomSheet, Button, Notice, Segmented, inputClass } from '@/components/ui';
import { isDemo } from '@/lib/supabase';
import BarcodeScanner from './BarcodeScanner';
import { loadCofid, searchFoods } from './cofid';
import { lookupBarcode } from './off';
import type { FoodResult } from './types';
import { searchUsda } from './usda';

// Find nutrition per 100 g: search CoFID (then USDA if needed), or scan a
// product's barcode (Open Food Facts). Typing it in from the pack stays in
// the ingredient form.

type Tab = 'search' | 'scan';

export default function NutritionFinder({
  open,
  initialQuery,
  onClose,
  onPick
}: {
  open: boolean;
  initialQuery: string;
  onClose: () => void;
  onPick: (r: FoodResult) => void;
}) {
  const [tab, setTab] = useState<Tab>('search');
  const [q, setQ] = useState('');
  const [cofid, setCofid] = useState<FoodResult[] | null>(null);
  const [usda, setUsda] = useState<FoodResult[] | null>(null);
  const [scanned, setScanned] = useState<FoodResult | null>(null);
  const [barcode, setBarcode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTab('search');
    setQ(initialQuery);
    setUsda(null);
    setScanned(null);
    setBarcode('');
    setError(null);
    loadCofid().then(setCofid, (err) => setError(err.message));
  }, [open, initialQuery]);

  useEffect(() => setUsda(null), [q]);

  const results = cofid ? searchFoods(cofid, q, 12) : [];

  async function findUsda() {
    setBusy(true);
    setError(null);
    try {
      setUsda(await searchUsda(q));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'USDA search failed.');
    } finally {
      setBusy(false);
    }
  }

  async function look(code: string) {
    setBusy(true);
    setError(null);
    setScanned(null);
    try {
      const r = await lookupBarcode(code);
      if (!r) setError(`Barcode ${code} isn't on Open Food Facts. Type the values in from the pack.`);
      else setScanned(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lookup failed.');
    } finally {
      setBusy(false);
    }
  }

  const row = (r: FoodResult) => (
    <button
      key={`${r.source}-${r.ref}`}
      type="button"
      onClick={() => onPick(r)}
      className="flex w-full items-center justify-between gap-2.5 rounded-btn border border-line bg-bg px-3.5 py-3 text-left"
    >
      <span className="min-w-0">
        <span className="block font-semibold leading-snug">{r.name}</span>
        <span className="text-[12px] text-muted">
          {r.source}
          {r.detail ? ` · ${r.detail}` : ''} · P {r.nutrition.p} · C {r.nutrition.c} · F {r.nutrition.f}
        </span>
      </span>
      <span className="tnum whitespace-nowrap text-[14px] font-bold">{r.nutrition.kcal} kcal</span>
    </button>
  );

  return (
    <BottomSheet open={open} onClose={onClose} title="Find nutrition">
      <div className="flex flex-col gap-3">
        <Segmented
          label="How to find it"
          options={[
            { id: 'search', label: 'Search' },
            { id: 'scan', label: 'Scan barcode' }
          ]}
          value={tab}
          onChange={setTab}
        />

        {tab === 'search' && (
          <>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. chicken breast grilled" aria-label="Search the food database" autoComplete="off" className={inputClass} />
            <p className="text-[12px] text-muted">Values are per 100 g. Pick the cooked version if your recipe weighs it cooked.</p>
            {!cofid && !error && <p className="text-[13px] text-muted">Loading the UK food database…</p>}
            <div className="flex max-h-[42dvh] flex-col gap-2 overflow-y-auto">
              {results.map(row)}
              {cofid && q.trim().length > 1 && results.length === 0 && <p className="text-[13px] text-muted">No CoFID match. Try fewer words, or search USDA.</p>}
              {usda?.map(row)}
              {usda && usda.length === 0 && <p className="text-[13px] text-muted">No USDA match either. Scan the barcode or type it in from the pack.</p>}
            </div>
            {q.trim().length > 1 && !usda && (
              <Button variant="secondary" onClick={() => void findUsda()} disabled={busy || isDemo}>
                {busy ? 'Searching USDA…' : isDemo ? 'USDA search needs Supabase' : 'Search USDA too'}
              </Button>
            )}
          </>
        )}

        {tab === 'scan' && (
          <>
            {!scanned && <BarcodeScanner onCode={(c) => void look(c)} />}
            <form
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                void look(barcode);
              }}
              className="flex gap-2"
            >
              <input
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                inputMode="numeric"
                placeholder="Or type the barcode"
                aria-label="Barcode number"
                className={`${inputClass} tnum`}
              />
              <button type="submit" disabled={busy} className="h-[52px] shrink-0 rounded-btn border border-line bg-surface px-4 font-bold">
                Look up
              </button>
            </form>
            {busy && <p className="text-[13px] text-muted">Looking it up…</p>}
            {scanned && (
              <>
                {row(scanned)}
                <Button variant="ghost" onClick={() => setScanned(null)}>
                  Scan another
                </Button>
              </>
            )}
          </>
        )}

        {error && <Notice tone="rose">{error}</Notice>}
        <p className="text-[11px] leading-relaxed text-muted">
          CoFID: McCance and Widdowson's Composition of Foods 2021. Contains public sector information licensed under the Open Government Licence
          v3.0. Also USDA FoodData Central and Open Food Facts (ODbL).
        </p>
      </div>
    </BottomSheet>
  );
}
