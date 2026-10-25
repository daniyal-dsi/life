import { useState, type FormEvent } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Pencil, Plus, Share2, X } from 'lucide-react';
import { Button, Card, IconButton, Notice, SectionTitle } from '@/components/ui';
import { addDays, fromISODate, toISODate } from '@/lib/date';
import { CheckButton } from '@/modules/workflow/parts';
import { shoppingList, shoppingText, weekPlan, type ShopItem } from './plan';
import { useMealPrep } from './store';
import { AISLES } from './types';

// Shared shopping list for a week: built from the plan, ticks shared by the
// household, editable amounts, extra items, and staples tucked away.

const short = (iso: string) => fromISODate(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const aisleLabel = (a: string) => AISLES.find((x) => x.id === a)?.label ?? a;

export default function ShoppingView({ monday, setMonday }: { monday: string; setMonday: (m: string) => void }) {
  const { meals, ingredients, plan, shopping, tickItem, setItemAmount, addExtra, tickExtra, removeExtra, untickAll } = useMealPrep();
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [extra, setExtra] = useState('');
  const [staplesOpen, setStaplesOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const list = shoppingList(weekPlan(plan, monday), meals, ingredients, shopping, monday, AISLES.map((a) => a.id));
  const left = list.total - list.done;
  const shift = (n: number) => setMonday(toISODate(addDays(fromISODate(monday), 7 * n)));

  async function share() {
    const text = shoppingText(list, monday, aisleLabel);
    try {
      if (navigator.share) await navigator.share({ title: 'Shopping list', text });
      else {
        await navigator.clipboard.writeText(text);
        setMessage('Copied the list. Paste it into a message.');
      }
    } catch {
      /* share cancelled */
    }
  }

  async function saveAmount(e: FormEvent, id: string) {
    e.preventDefault();
    await setItemAmount(monday, id, editValue);
    setEditing(null);
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!extra.trim()) return;
    await addExtra(monday, extra);
    setExtra('');
  }

  const row = (i: ShopItem) => {
    const id = i.ingredient.id;
    const shown = i.amount ?? i.calc;
    return (
      <div key={id} className="border-line [&+&]:border-t">
        <div className="flex items-start gap-3 px-4 py-3">
          <span className="mt-0.5">
            <CheckButton done={i.done} title={i.ingredient.name} onToggle={() => void tickItem(monday, id, !i.done)} />
          </span>
          <div className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-1.5">
              <span className={`font-bold ${i.done ? 'text-muted line-through' : ''}`}>{i.ingredient.name}</span>
              {i.ingredient.ask && <span className="rounded-[6px] bg-coral-soft px-1.5 text-[11px] font-extrabold text-coral-ink">Type?</span>}
            </span>
            <span className="mt-0.5 block text-[13px] text-muted">{i.meals}</span>
            {i.cooked && <span className="block text-[13px] text-muted">Raw weight to buy · {i.cooked} once cooked</span>}
            {i.amount && <span className="block text-[13px] font-bold text-violet-ink">Edited · calculated {i.calc || 'no amount'}</span>}
          </div>
          <button
            type="button"
            aria-label={shown ? `Edit amount for ${i.ingredient.name}` : `Add an amount for ${i.ingredient.name}`}
            onClick={() => {
              setEditing(editing === id ? null : id);
              setEditValue(shown);
            }}
            className={shown ? 'tnum whitespace-nowrap rounded-chip bg-chip px-2.5 py-1.5 text-[13px] font-bold' : 'inline-flex h-9 w-9 items-center justify-center rounded-ctl text-muted'}
          >
            {shown || <Pencil size={16} aria-hidden />}
          </button>
        </div>
        {editing === id && (
          <form onSubmit={(e) => void saveAmount(e, id)} className="flex flex-wrap gap-2 px-4 pb-3 pl-14">
            <input
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder="e.g. 2 packs"
              aria-label={`Amount for ${i.ingredient.name}`}
              className="h-11 min-w-[120px] flex-1 rounded-ctl border border-line2 bg-bg px-3 text-[16px]"
            />
            <button type="submit" className="h-11 rounded-ctl border border-line bg-surface px-3.5 text-[13px] font-bold">
              Save
            </button>
            {i.amount && (
              <button
                type="button"
                onClick={async () => {
                  await setItemAmount(monday, id, null);
                  setEditing(null);
                }}
                className="h-11 rounded-ctl border border-line bg-surface px-3.5 text-[13px] font-bold"
              >
                Reset
              </button>
            )}
          </form>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <IconButton icon={ChevronLeft} label="Previous week" onClick={() => shift(-1)} />
        <span className="text-center text-[16px] font-extrabold">Week of {short(monday)}</span>
        <IconButton icon={ChevronRight} label="Next week" onClick={() => shift(1)} />
      </div>

      <Card dark className="!p-5">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[14px] text-hero-muted">Left to buy</p>
            <p className="disp tnum mt-1.5 text-[88px] !leading-[0.85] text-sun [text-shadow:var(--glow-sun)]">{left}</p>
          </div>
          <p className="pb-1.5 text-[13px] text-hero-muted">
            {list.done} of {list.total} ticked
          </p>
        </div>
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-green" style={{ width: `${list.total ? (list.done / list.total) * 100 : 0}%` }} />
        </div>
      </Card>

      <Notice>Amounts are what to buy. Recipes use cooked weights, so meat is scaled up for the weight it loses in cooking. Tap an amount to change it.</Notice>
      {list.total === 0 && list.staples.length === 0 && <Card className="text-[13px] text-muted">Plan some meals for this week and their ingredients appear here.</Card>}

      {list.aisles.map((g) => (
        <section key={g.aisle}>
          <SectionTitle right={`${g.items.filter((i) => !i.done).length} left`}>{aisleLabel(g.aisle)}</SectionTitle>
          <div className="rounded-card border border-line bg-surface">{g.items.map(row)}</div>
        </section>
      ))}

      <section>
        <SectionTitle>Other items</SectionTitle>
        <div className="rounded-card border border-line bg-surface">
          {list.extras.map((e) => (
            <div key={e.id} className="flex items-center gap-3 border-b border-line px-4 py-3">
              <CheckButton done={e.done} title={e.name} onToggle={() => void tickExtra(e.id, !e.done)} />
              <span className={`min-w-0 flex-1 font-bold ${e.done ? 'text-muted line-through' : ''}`}>{e.name}</span>
              <button type="button" aria-label={`Remove ${e.name}`} onClick={() => void removeExtra(e.id)} className="inline-flex h-9 w-9 items-center justify-center text-muted">
                <X size={16} aria-hidden />
              </button>
            </div>
          ))}
          <form onSubmit={(e) => void add(e)} className="flex gap-2 p-3">
            <input
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              maxLength={80}
              placeholder="Add something else, e.g. kitchen roll"
              aria-label="Add an item"
              autoComplete="off"
              className="h-12 min-w-0 flex-1 rounded-ctl border border-line2 bg-bg px-3 text-[16px]"
            />
            <button type="submit" className="inline-flex h-12 items-center gap-1 rounded-ctl border border-line bg-surface px-3.5 text-[13px] font-bold">
              <Plus size={14} strokeWidth={2.5} aria-hidden />
              Add
            </button>
          </form>
        </div>
      </section>

      {list.staples.length > 0 && (
        <div className="overflow-hidden rounded-card border border-line bg-surface">
          <button type="button" aria-expanded={staplesOpen} onClick={() => setStaplesOpen((o) => !o)} className="flex w-full items-center justify-between gap-3 p-4 text-left">
            <span>
              <span className="block text-[16px] font-bold">Staples</span>
              <span className="text-[13px] text-muted">
                {list.staples.length} item{list.staples.length === 1 ? '' : 's'} you usually have. Check before you go.
              </span>
            </span>
            {staplesOpen ? <ChevronUp size={18} aria-hidden /> : <ChevronDown size={18} aria-hidden />}
          </button>
          {staplesOpen && <div className="border-t border-line">{list.staples.map(row)}</div>}
        </div>
      )}

      {message && <Notice tone="green">{message}</Notice>}
      <Button variant="ghost" disabled={!list.done} onClick={() => void untickAll(monday)}>
        Untick everything
      </Button>
      <Button variant="sun" icon={Share2} onClick={() => void share()}>
        Share list
      </Button>
    </>
  );
}
