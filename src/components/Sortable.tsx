import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';

// Vertical drag-to-reorder list. Drag a row by its handle (mouse or touch),
// or focus the handle and use the arrow keys. The new order shows at once and
// is reported through onReorder.

export type HandleProps = {
  onPointerDown: (e: PointerEvent<HTMLElement>) => void;
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
  'aria-label': string;
  'data-handle': true;
  style: { touchAction: 'none'; cursor: string };
};

export function SortableList<T>({
  items,
  getKey,
  onReorder,
  label,
  renderItem
}: {
  items: T[];
  getKey: (item: T) => string;
  onReorder: (keys: string[]) => void;
  /** Used in the handle's label, e.g. "Move Draft copy". */
  label: (item: T) => string;
  renderItem: (item: T, handle: HandleProps, dragging: boolean) => ReactNode;
}) {
  const [order, setOrder] = useState(() => items.map(getKey));
  const [drag, setDrag] = useState<{ key: string; from: number; dy: number; to: number } | null>(null);
  const rows = useRef(new Map<string, HTMLDivElement>());
  const geom = useRef<{ tops: number[]; heights: number[]; startY: number } | null>(null);

  // Follow the incoming order unless a drag is in progress.
  const incoming = items.map(getKey).join('|');
  useEffect(() => {
    if (!drag) setOrder(items.map(getKey));
  }, [incoming]);

  const byKey = new Map(items.map((i) => [getKey(i), i]));
  const list = order.filter((k) => byKey.has(k));

  const commit = (next: string[]) => {
    setOrder(next);
    if (next.join('|') !== list.join('|')) onReorder(next);
  };

  function start(key: string, e: PointerEvent<HTMLElement>) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const boxes = list.map((k) => rows.current.get(k)!.getBoundingClientRect());
    geom.current = { tops: boxes.map((b) => b.top), heights: boxes.map((b) => b.height), startY: e.clientY };
    const from = list.indexOf(key);
    setDrag({ key, from, dy: 0, to: from });
    navigator.vibrate?.(10);
    const el = e.currentTarget;
    const move = (ev: globalThis.PointerEvent) => {
      const g = geom.current!;
      const dy = ev.clientY - g.startY;
      // New position = how many other rows have their middle above the dragged row's middle.
      const centre = g.tops[from] + g.heights[from] / 2 + dy;
      let to = 0;
      for (let i = 0; i < g.tops.length; i++) if (i !== from && centre > g.tops[i] + g.heights[i] / 2) to++;
      setDrag({ key, from, dy, to });
    };
    const end = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', end);
      el.removeEventListener('pointercancel', end);
      setDrag((d) => {
        if (d && d.to !== d.from) {
          const next = [...list];
          next.splice(d.to, 0, ...next.splice(d.from, 1));
          queueMicrotask(() => commit(next));
        }
        return null;
      });
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  function key(k: string, e: KeyboardEvent<HTMLElement>) {
    const i = list.indexOf(k);
    const j = e.key === 'ArrowUp' ? i - 1 : e.key === 'ArrowDown' ? i + 1 : -2;
    if (j < 0 || j >= list.length) return;
    e.preventDefault();
    const next = [...list];
    next.splice(j, 0, ...next.splice(i, 1));
    commit(next);
    requestAnimationFrame(() => rows.current.get(k)?.querySelector<HTMLElement>('[data-handle]')?.focus());
  }

  // How far each row shifts while another is dragged over it.
  function shift(i: number): number {
    if (!drag || !geom.current) return 0;
    const h = geom.current.heights[drag.from];
    if (i === drag.from) return drag.dy;
    if (drag.from < drag.to && i > drag.from && i <= drag.to) return -h;
    if (drag.from > drag.to && i < drag.from && i >= drag.to) return h;
    return 0;
  }

  return (
    <div role="list">
      {list.map((k, i) => {
        const item = byKey.get(k)!;
        const dragging = drag?.key === k;
        return (
          <div
            key={k}
            role="listitem"
            ref={(el) => {
              if (el) rows.current.set(k, el);
              else rows.current.delete(k);
            }}
            style={{
              transform: `translateY(${shift(i)}px)`,
              transition: dragging || !drag ? 'none' : 'transform 150ms ease',
              position: 'relative',
              zIndex: dragging ? 10 : undefined
            }}
          >
            {renderItem(
              item,
              {
                onPointerDown: (e) => start(k, e),
                onKeyDown: (e) => key(k, e),
                'aria-label': `${label(item)}: drag, or use the arrow keys to reorder`,
                'data-handle': true,
                style: { touchAction: 'none', cursor: dragging ? 'grabbing' : 'grab' }
              },
              dragging
            )}
          </div>
        );
      })}
    </div>
  );
}
