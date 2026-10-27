import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, Header, IconButton, Notice, Page, Segmented } from '@/components/ui';
import { addDays, formatLong, fromISODate, startOfWeek, toISODate, todayISO } from '@/lib/date';
import { dataOf } from '@/lib/useVersioned';
import { useWorkflow } from '@/modules/workflow/store';
import BlockSheet, { type SheetState } from './BlockSheet';
import { chipKeys, look, type ChipKey } from './buckets';
import { useCalendar } from './store';
import { clampDay, duration, hhmm, itemsFor, lanes, snap15, workFor } from './time';
import { CAL_END, CAL_START, type Item } from './types';

// Day and week planner. Chips are dragged onto the timeline (press and hold on
// a phone), or tapped and then a time tapped. Blocks move by dragging and
// resize from the bottom edge, snapping to 15 minutes.

type Drag = {
  mode: 'new' | 'move' | 'resize';
  el: HTMLElement;
  blk?: HTMLElement;
  x0: number;
  y0: number;
  moved: boolean;
  armed: boolean;
  timer?: number;
  chip?: ChipKey;
  id?: string;
  hh?: number;
  grab?: number;
  h0?: number;
  ghost?: HTMLElement;
};

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const shortDate = (iso: string) => fromISODate(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const nowMin = () => {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
};

function colAt(x: number, y: number): HTMLElement | null {
  for (const c of document.querySelectorAll<HTMLElement>('.cal-col')) {
    const r = c.getBoundingClientRect();
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return c;
  }
  return null;
}
const colMin = (col: HTMLElement, y: number) => CAL_START * 60 + ((y - col.getBoundingClientRect().top) / Number(col.dataset.hh)) * 60;

export default function Calendar() {
  const cal = useCalendar();
  const { buckets } = useWorkflow();
  const today = todayISO();
  const [view, setView] = useState<'day' | 'week'>('day');
  const [date, setDate] = useState(today);
  const [armed, setArmed] = useState<ChipKey | null>(null);
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [, tick] = useState(0);
  const drag = useRef<Drag | null>(null);
  const suppress = useRef(0);

  const monday = toISODate(startOfWeek(fromISODate(date)));
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => toISODate(addDays(fromISODate(monday), i))), [monday]);
  const dates = view === 'day' ? [date] : week;

  // Keep the now-line moving.
  useEffect(() => {
    const t = window.setInterval(() => tick((n) => n + 1), 60_000);
    return () => window.clearInterval(t);
  }, []);
  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(() => setMessage(null), 4000);
    return () => window.clearTimeout(t);
  }, [message]);

  // Latest data for the document-level drag handlers.
  const live = useRef({ cal, buckets });
  live.current = { cal, buckets };

  function itemTimes(id: string) {
    const { cal } = live.current;
    if (id.startsWith('work|')) {
      const w = workFor(cal.work, id.slice(5));
      return w && { start: w.start_min, end: w.end_min };
    }
    const b = cal.blocks.find((x) => x.id === id);
    return b && { start: b.start_min, end: b.end_min };
  }

  async function create(chip: ChipKey, d: string, min: number) {
    const start = clampDay(snap15(min));
    if (chip !== 'work') return setSheet({ mode: 'new', chip, date: d, start });
    const { cal } = live.current;
    if (workFor(cal.work, d)) return setMessage(`Work is already on ${shortDate(d)}. Drag it to change the hours.`);
    await cal.setWorkDay(d, start, Math.min(start + 480, CAL_END * 60));
    setMessage(`Work added on ${shortDate(d)}.`);
  }

  async function move(id: string, d: string, min: number) {
    const { cal } = live.current;
    const t = itemTimes(id);
    if (!t) return;
    const len = t.end - t.start;
    const start = clampDay(snap15(min), len);
    if (id.startsWith('work|')) {
      const od = id.slice(5);
      if (d !== od) return setMessage('Work stays on its own day. Drag it up or down to change the hours.');
      await cal.setWorkDay(od, start, start + len);
      return setMessage(`Work now ${hhmm(start)}–${hhmm(start + len)}.`);
    }
    const b = cal.blocks.find((x) => x.id === id)!;
    await cal.saveBlock({ ...dataOf(b), date: d, start_min: start, end_min: start + len }, id);
    setMessage(`Moved to ${d === todayISO() ? 'today' : shortDate(d)}, ${hhmm(start)}.`);
  }

  async function resize(id: string, endMin: number) {
    const { cal } = live.current;
    const t = itemTimes(id);
    if (!t) return;
    const end = Math.max(t.start + 15, Math.min(snap15(endMin), CAL_END * 60));
    if (id.startsWith('work|')) await cal.setWorkDay(id.slice(5), t.start, end);
    else {
      const b = cal.blocks.find((x) => x.id === id)!;
      await cal.saveBlock({ ...dataOf(b), end_min: end }, id);
    }
    setMessage(`Now ${hhmm(t.start)}–${hhmm(end)}.`);
  }

  // Pointer handling, ported from the prototype: mouse drags as soon as it
  // moves; touch needs a 400 ms hold first so the page still scrolls.
  const handlers = useRef({ create, move, resize, itemTimes });
  handlers.current = { create, move, resize, itemTimes };
  useEffect(() => {
    const lifted = (d: Drag) => d.blk ?? d.el;
    const clearDrop = (keep?: Element | null) => document.querySelectorAll('.cal-col.drop').forEach((x) => x !== keep && x.classList.remove('drop'));

    function down(e: PointerEvent) {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-drag]');
      if (!el || e.button > 0) return;
      const mode = el.dataset.drag as Drag['mode'];
      const d: Drag = { mode, el, x0: e.clientX, y0: e.clientY, moved: false, armed: e.pointerType !== 'touch', chip: el.dataset.chip as ChipKey, id: el.dataset.id };
      if (mode !== 'new') {
        d.blk = mode === 'resize' ? el.parentElement! : el;
        d.hh = Number(d.blk.parentElement!.dataset.hh);
        d.grab = ((e.clientY - d.blk.getBoundingClientRect().top) / d.hh) * 60;
        d.h0 = d.blk.offsetHeight;
      }
      if (!d.armed)
        d.timer = window.setTimeout(() => {
          if (drag.current !== d) return;
          d.armed = true;
          suppress.current = Date.now() + 600;
          lifted(d).classList.add('lifted');
          try {
            navigator.vibrate?.(12);
          } catch {
            /* not supported */
          }
        }, 400);
      drag.current = d;
    }

    function moveEv(e: PointerEvent) {
      const d = drag.current;
      if (!d) return;
      const dx = e.clientX - d.x0;
      const dy = e.clientY - d.y0;
      if (!d.moved && Math.abs(dx) + Math.abs(dy) < 8) return;
      if (!d.armed) {
        window.clearTimeout(d.timer);
        drag.current = null;
        return;
      }
      if (!d.moved) {
        d.moved = true;
        if (d.mode === 'new') {
          const g = document.createElement('div');
          g.className = `cal-ghost ${d.el.dataset.cls}`;
          g.textContent = d.el.dataset.name ?? '';
          document.body.appendChild(g);
          d.ghost = g;
        } else d.blk!.classList.add('dragging');
      }
      if (e.cancelable) e.preventDefault();
      if (d.mode === 'new') {
        d.ghost!.style.left = `${e.clientX}px`;
        d.ghost!.style.top = `${e.clientY}px`;
        const c = colAt(e.clientX, e.clientY);
        clearDrop(c);
        c?.classList.add('drop');
      } else if (d.mode === 'move') d.blk!.style.transform = `translate(${dx}px, ${dy}px)`;
      else d.blk!.style.height = `${Math.max(d.hh! / 4, d.h0! + dy)}px`;
    }

    function end(e: PointerEvent, cancel: boolean) {
      const d = drag.current;
      if (!d) return;
      drag.current = null;
      window.clearTimeout(d.timer);
      lifted(d).classList.remove('lifted');
      d.ghost?.remove();
      clearDrop();
      if (!d.moved) return;
      suppress.current = Date.now() + 300;
      const reset = () => {
        if (d.blk) {
          d.blk.style.transform = '';
          d.blk.style.height = '';
          d.blk.classList.remove('dragging');
        }
      };
      const h = handlers.current;
      const c = cancel ? null : colAt(e.clientX, e.clientY);
      let p: Promise<unknown> | undefined;
      if (cancel) reset();
      else if (d.mode === 'new') {
        if (c) {
          setArmed(null);
          p = h.create(d.chip!, c.dataset.date!, colMin(c, e.clientY) - 30);
        }
      } else if (d.mode === 'move') p = c ? h.move(d.id!, c.dataset.date!, colMin(c, e.clientY) - d.grab!) : undefined;
      else {
        const t = h.itemTimes(d.id!);
        if (t) p = h.resize(d.id!, t.start + ((d.h0! + (e.clientY - d.y0)) / d.hh!) * 60);
      }
      // The block re-renders in its new place; clear the inline drag styles after.
      void Promise.resolve(p).finally(reset);
    }

    const up = (e: PointerEvent) => end(e, false);
    const cancel = (e: PointerEvent) => end(e, true);
    const touch = (e: TouchEvent) => drag.current?.armed && e.cancelable && e.preventDefault();
    const menu = (e: Event) => drag.current?.armed && e.preventDefault();
    document.addEventListener('pointerdown', down);
    document.addEventListener('pointermove', moveEv, { passive: false });
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', cancel);
    document.addEventListener('touchmove', touch, { passive: false });
    document.addEventListener('contextmenu', menu);
    return () => {
      document.removeEventListener('pointerdown', down);
      document.removeEventListener('pointermove', moveEv);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', cancel);
      document.removeEventListener('touchmove', touch);
      document.removeEventListener('contextmenu', menu);
    };
  }, []);

  const suppressed = () => Date.now() < suppress.current;

  function tapColumn(e: React.MouseEvent<HTMLDivElement>, d: string) {
    if (e.target !== e.currentTarget || suppressed()) return;
    const min = Math.floor(colMin(e.currentTarget, e.clientY) / 15) * 15;
    if (armed) {
      const c = armed;
      setArmed(null);
      return void create(c, d, min);
    }
    setSheet({ mode: 'plan', date: d, start: clampDay(min) });
  }

  function openItem(it: Item) {
    if (suppressed()) return;
    if (it.type === 'work') setSheet({ mode: 'work', date: it.date });
    else setSheet({ mode: 'edit', block: it.block });
  }

  function nav(step: number) {
    if (!step) return setDate(today);
    setDate(toISODate(addDays(fromISODate(date), step * (view === 'day' ? 1 : 7))));
  }

  const isCurrent = view === 'day' ? date === today : monday === toISODate(startOfWeek(new Date()));
  const title = view === 'day' ? (date === today ? 'Today' : shortDate(date)) : `Week of ${shortDate(monday)}`;
  const label = view === 'day' ? formatLong(fromISODate(date)) : `${shortDate(monday)} to ${shortDate(week[6])}`;
  const hh = view === 'day' ? 56 : 40;

  // Time per kind on the day.
  const totals = useMemo(() => {
    if (view !== 'day') return [];
    const t = new Map<ChipKey, number>();
    for (const it of itemsFor(date, cal.blocks, cal.work)) {
      const k: ChipKey = it.type === 'work' ? 'work' : it.block.kind === 'gym' ? 'gym' : `bucket:${it.block.bucket_id}`;
      t.set(k, (t.get(k) ?? 0) + it.end - it.start);
    }
    return [...t];
  }, [view, date, cal.blocks, cal.work]);

  return (
    <Page>
      <Header label={label} title={title} />
      <Segmented
        label="View"
        options={[
          { id: 'day', label: 'Day' },
          { id: 'week', label: 'Week' }
        ]}
        value={view}
        onChange={(v) => {
          setView(v);
          setArmed(null);
        }}
      />

      {view === 'day' && (
        <div className="grid grid-cols-7 gap-1.5">
          {week.map((d) => {
            const active = d === date;
            const has = cal.blocks.some((b) => b.date === d);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={active}
                aria-label={formatLong(fromISODate(d))}
                onClick={() => setDate(d)}
                className={`flex flex-col items-center gap-0.5 rounded-btn border py-2 ${active ? 'border-ink bg-ink text-bg' : 'border-line bg-surface'}`}
              >
                <span className={`text-[11px] font-semibold ${active ? 'text-hero-muted' : 'text-muted'}`}>{DOW[fromISODate(d).getDay()]}</span>
                <b className="font-display text-[17px] tnum">{fromISODate(d).getDate()}</b>
                <i className={`h-1 w-1 rounded-full ${has ? (active ? 'bg-sun' : 'bg-violet') : 'bg-transparent'}`} />
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between">
        <IconButton icon={ChevronLeft} label={`Previous ${view}`} onClick={() => nav(-1)} />
        <button type="button" disabled={isCurrent} onClick={() => nav(0)} className="h-10 rounded-ctl border border-line2 bg-surface px-4 font-semibold">
          {view === 'day' ? 'Today' : 'This week'}
        </button>
        <IconButton icon={ChevronRight} label={`Next ${view}`} onClick={() => nav(1)} />
      </div>

      <Card>
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-baseline justify-between gap-1">
            <b>Drag onto the {view}</b>
            <span className="text-[13px] text-muted">On a phone, press and hold to pick one up. Or tap one, then tap a time.</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {chipKeys(buckets).map((c) => {
              const l = look(c, buckets);
              return (
                <button
                  key={c}
                  type="button"
                  data-drag="new"
                  data-chip={c}
                  data-cls={l.cls}
                  data-name={l.name}
                  aria-pressed={armed === c}
                  onClick={() => !suppressed() && setArmed(armed === c ? null : c)}
                  className={`calchip inline-flex h-10 items-center gap-2 rounded-ctl px-3.5 text-[14px] font-extrabold ${l.cls} ${armed === c ? 'outline outline-[3px] outline-offset-2 outline-ink' : ''}`}
                >
                  <l.icon size={16} aria-hidden />
                  {l.name}
                </button>
              );
            })}
          </div>
          {buckets.length === 0 && <p className="text-[13px] text-muted">Add buckets in Work and they appear here too.</p>}
          {armed && (
            <div className="flex items-center justify-between gap-2 rounded-btn bg-sun-soft px-3 py-2 text-sun-ink">
              <span>
                Tap a time to place <b>{look(armed, buckets).name}</b>
              </span>
              <button type="button" onClick={() => setArmed(null)} className="h-9 rounded-ctl border border-line2 bg-surface px-3 font-semibold text-ink">
                Cancel
              </button>
            </div>
          )}
        </div>
      </Card>

      {message && (
        <div role="status" aria-live="polite">
          <Notice>{message}</Notice>
        </div>
      )}
      {cal.error && <Notice tone="rose">{cal.error}</Notice>}

      {totals.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {totals.map(([k, min]) => {
            const l = look(k, buckets);
            return (
              <span key={k} className="inline-flex h-8 items-center gap-2 rounded-chip border border-line bg-surface px-2.5 text-[13px] font-semibold">
                <span className={`h-2.5 w-2.5 rounded-[3px] ${l.cls}`} aria-hidden />
                {l.name} · {duration(min)}
              </span>
            );
          })}
        </div>
      )}

      <div>
        {view === 'week' && (
          <div className="mb-1 grid grid-cols-[44px_minmax(0,1fr)]">
            <span />
            <div className="grid grid-cols-7 gap-1">
              {week.map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-label={`Open ${formatLong(fromISODate(d))}`}
                  onClick={() => {
                    setDate(d);
                    setView('day');
                  }}
                  className={`rounded-ctl py-1.5 text-center text-[12px] font-bold text-muted ${d === today ? 'bg-sun-soft' : ''}`}
                >
                  {DOW[fromISODate(d).getDay()]}
                  <b className={`block font-display text-[16px] tnum ${d === today ? 'text-sun-ink' : 'text-ink'}`}>{fromISODate(d).getDate()}</b>
                </button>
              ))}
            </div>
          </div>
        )}
        <div
          className={`relative grid select-none grid-cols-[44px_minmax(0,1fr)] ${view === 'week' ? 'cal-wk' : ''}`}
          style={{ height: (CAL_END - CAL_START) * hh }}
        >
          <div className="relative" aria-hidden>
            {Array.from({ length: CAL_END - CAL_START }, (_, i) => (
              <span key={i} className={`absolute left-0 text-[11px] text-muted tnum ${i ? '-translate-y-1/2' : ''}`} style={{ top: i * hh }}>
                {hhmm((CAL_START + i) * 60)}
              </span>
            ))}
          </div>
          <div className="grid h-full gap-1" style={{ gridTemplateColumns: `repeat(${dates.length}, minmax(0, 1fr))` }}>
            {dates.map((d) => (
              <Column key={d} date={d} hh={hh} compact={view === 'week'} onTap={tapColumn} onOpen={openItem} />
            ))}
          </div>
        </div>
      </div>

      <BlockSheet state={sheet} onClose={() => setSheet(null)} onMessage={setMessage} />
    </Page>
  );
}

function Column({
  date,
  hh,
  compact,
  onTap,
  onOpen
}: {
  date: string;
  hh: number;
  compact: boolean;
  onTap: (e: React.MouseEvent<HTMLDivElement>, d: string) => void;
  onOpen: (it: Item) => void;
}) {
  const { blocks, work } = useCalendar();
  const { buckets } = useWorkflow();
  const lo = CAL_START * 60;
  const hi = CAL_END * 60;
  const items = lanes(itemsFor(date, blocks, work));
  const now = nowMin();

  return (
    <div
      className="cal-col relative h-full min-w-0 rounded-btn border border-line"
      data-date={date}
      data-hh={hh}
      style={{ ['--hh' as string]: `${hh}px` }}
      onClick={(e) => onTap(e, date)}
      aria-label={formatLong(fromISODate(date))}
    >
      {items.map((it) => {
        if (it.end <= lo || it.start >= hi) return null;
        const key: ChipKey = it.type === 'work' ? 'work' : it.block.kind === 'gym' ? 'gym' : `bucket:${it.block.bucket_id}`;
        const l = look(key, buckets);
        const sub =
          it.type === 'work'
            ? `${hhmm(it.start)}–${hhmm(it.end)} · ${duration(it.end - it.start)}`
            : `${it.block.kind === 'gym' ? it.block.template_name ?? 'Pick a workout' : it.block.task_title ?? 'No task picked'} · ${hhmm(it.start)}–${hhmm(it.end)}`;
        const short = it.type === 'work' ? 'Work' : it.block.kind === 'gym' ? it.block.template_name ?? 'Gym' : l.name;
        const top = ((Math.max(it.start, lo) - lo) * hh) / 60;
        const height = Math.max(20, ((Math.min(it.end, hi) - Math.max(it.start, lo)) * hh) / 60);
        const w = 100 / it.lanes;
        return (
          <button
            key={it.id}
            type="button"
            data-drag="move"
            data-id={it.id}
            onClick={() => onOpen(it)}
            aria-label={`${l.name}, ${sub}`}
            className={`cal-ev absolute flex h-[var(--h)] min-w-0 flex-col gap-px overflow-hidden text-left text-[12px] leading-tight ${l.cls} ${compact ? 'rounded-[7px] px-1 py-[3px]' : 'rounded-ctl px-2 py-1'}`}
            // Height via a variable: drags set style.height directly and clear it after.
            style={{ top, ['--h' as string]: `${height}px`, left: `calc(${w * it.lane}% + 2px)`, width: `calc(${w}% - 4px)` }}
          >
            <b className={`truncate font-extrabold ${compact ? 'text-[10.5px]' : 'text-[13px]'}`}>{compact ? short : l.name}</b>
            {!compact && <span className="truncate opacity-85">{sub}</span>}
            <i className="cal-rs absolute inset-x-0 bottom-0 h-3.5" data-drag="resize" data-id={it.id} aria-hidden />
          </button>
        );
      })}
      {date === todayISO() && now > lo && now < hi && (
        <div className="pointer-events-none absolute inset-x-0 z-[4] h-0.5 bg-rose" style={{ top: ((now - lo) * hh) / 60 }}>
          <span className="absolute -left-[5px] -top-1 h-2.5 w-2.5 rounded-full bg-rose" />
        </div>
      )}
    </div>
  );
}
