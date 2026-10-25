import { useId, useState, type PointerEvent } from 'react';

// Small SVG charts. Colours come from tokens (pass a CSS colour such as
// "rgb(var(--coral))"); text always uses ink/muted tokens, never series colours.

export type LinePoint = { label: string; value: number; highlight?: boolean };

/**
 * Single-series line chart with a hover/touch crosshair and readout.
 * `highlight` points (e.g. PRs) get a larger sun-coloured marker.
 */
export function LineChart({
  points,
  color,
  area,
  label,
  format = (v) => String(v),
  step = 2.5,
  empty
}: {
  points: LinePoint[];
  color: string;
  area: string;
  label: string;
  format?: (v: number) => string;
  /** Axis rounding step. */
  step?: number;
  empty: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (!points.length) return <p className="py-6 text-center text-[13px] text-muted">{empty}</p>;

  const W = 320;
  const H = 168;
  const l = 38;
  const r = 14;
  const t = 14;
  const b = 26;
  const vals = points.map((p) => p.value);
  let lo = Math.floor(Math.min(...vals) / step) * step - step;
  let hi = Math.ceil(Math.max(...vals) / step) * step + step;
  if (hi - lo < step * 3) hi = lo + step * 3;
  lo = Math.max(0, lo);
  const mid = lo + Math.round((hi - lo) / 2 / step) * step;
  const X = (i: number) => (points.length === 1 ? (l + W - r) / 2 : l + ((W - l - r) * i) / (points.length - 1));
  const Y = (v: number) => t + (H - t - b) * (1 - (v - lo) / (hi - lo));
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(p.value).toFixed(1)}`).join(' ');
  const ticks = points.length > 2 ? [0, Math.floor((points.length - 1) / 2), points.length - 1] : points.map((_, i) => i);

  function onMove(e: PointerEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * W;
    let best = 0;
    points.forEach((_, i) => {
      if (Math.abs(X(i) - x) < Math.abs(X(best) - x)) best = i;
    });
    setHover(best);
  }

  const hp = hover === null ? null : points[hover];

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label={label}
        className="block max-w-full touch-pan-y"
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {[hi, mid, lo].map((v) => (
          <g key={v}>
            <line x1={l} x2={W - r} y1={Y(v)} y2={Y(v)} stroke="rgb(var(--line))" strokeWidth={1} />
            <text x={0} y={Y(v) + 4} fontSize={11} fill="rgb(var(--muted))">
              {format(v)}
            </text>
          </g>
        ))}
        {points.length > 1 && (
          <path d={`${d} L${X(points.length - 1).toFixed(1)} ${H - b} L${X(0).toFixed(1)} ${H - b} Z`} fill={area} />
        )}
        <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {hp && hover !== null && (
          <line x1={X(hover)} x2={X(hover)} y1={t} y2={H - b} stroke="rgb(var(--muted))" strokeWidth={1} strokeDasharray="3 3" />
        )}
        {points.map((p, i) =>
          p.highlight ? (
            <circle key={i} cx={X(i)} cy={Y(p.value)} r={6} fill="rgb(var(--sun))" stroke="rgb(var(--surface))" strokeWidth={2} />
          ) : (
            <circle
              key={i}
              cx={X(i)}
              cy={Y(p.value)}
              r={i === hover || i === points.length - 1 ? 5 : 4}
              fill={color}
              stroke="rgb(var(--surface))"
              strokeWidth={2}
            />
          )
        )}
        {ticks.map((i) => (
          <text
            key={i}
            x={X(i)}
            y={H - 6}
            fontSize={11}
            textAnchor={points.length === 1 ? 'middle' : i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}
            fill={i === points.length - 1 ? 'rgb(var(--text))' : 'rgb(var(--muted))'}
            fontWeight={i === points.length - 1 ? 700 : 400}
          >
            {points[i].label}
          </text>
        ))}
      </svg>
      {hp && hover !== null && (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 whitespace-nowrap rounded-ctl border border-line bg-surface px-2.5 py-1.5 text-[12px] shadow-[var(--shadow)]"
          style={{ left: `${(X(hover) / W) * 100}%` }}
          role="status"
        >
          <span className="text-muted">{hp.label} · </span>
          <b className="tnum">{format(hp.value)}</b>
          {hp.highlight && <span className="font-bold text-sun-ink"> · PR</span>}
        </div>
      )}
      <details className="mt-2 text-[13px]">
        <summary className="cursor-pointer text-muted">Show as a table</summary>
        <table className="mt-2 w-full text-left">
          <tbody>
            {points.map((p, i) => (
              <tr key={i} className="border-t border-line">
                <td className="py-1 text-muted">{p.label}</td>
                <td className="tnum py-1 text-right font-semibold">
                  {format(p.value)}
                  {p.highlight ? ' · PR' : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

export type DonutSlice = { key: string; label: string; value: number; color: string };

/**
 * Donut with a 2px surface gap between slices, a centre readout that follows
 * hover/tap, and a legend with each slice's share (so colour never carries
 * meaning alone).
 */
export function Donut({
  slices,
  total,
  centre,
  centreUnit,
  label,
  format = (v) => String(v)
}: {
  slices: DonutSlice[];
  total: number;
  centre: string;
  centreUnit: string;
  label: string;
  format?: (v: number) => string;
}) {
  const [active, setActive] = useState<string | null>(null);
  const titleId = useId();
  const R = 50;
  const C = 2 * Math.PI * R;
  const gap = slices.filter((s) => s.value > 0).length > 1 ? 2 : 0;
  let offset = 0;
  const act = slices.find((s) => s.key === active);

  return (
    <div className="flex items-center gap-[18px]">
      <svg width={136} height={136} viewBox="0 0 130 130" role="img" aria-labelledby={titleId} className="shrink-0">
        <title id={titleId}>{label}</title>
        <circle cx={65} cy={65} r={R} fill="none" strokeWidth={20} stroke="rgb(var(--chip))" />
        <g transform="rotate(-90 65 65)">
          {slices.map((s) => {
            if (s.value <= 0) return null;
            const len = (s.value / total) * C;
            const el = (
              <circle
                key={s.key}
                cx={65}
                cy={65}
                r={R}
                fill="none"
                strokeWidth={active === s.key ? 24 : 20}
                stroke={s.color}
                strokeDasharray={`${Math.max(0.5, len - gap).toFixed(2)} ${C.toFixed(2)}`}
                strokeDashoffset={(-offset).toFixed(2)}
                className="cursor-pointer transition-[stroke-width]"
                onPointerEnter={() => setActive(s.key)}
                onPointerDown={() => setActive(s.key)}
                onPointerLeave={() => setActive(null)}
              />
            );
            offset += len;
            return el;
          })}
        </g>
        <text x={65} y={63} textAnchor="middle" fontSize={act ? 18 : 22} className="disp" fill="rgb(var(--text))">
          {act ? format(act.value) : centre}
        </text>
        <text x={65} y={81} textAnchor="middle" fontSize={11} fill="rgb(var(--muted))">
          {act ? act.label : centreUnit}
        </text>
      </svg>
      <ul className="flex min-w-0 flex-1 flex-col gap-[7px] text-[13px]">
        {slices.map((s) => (
          <li
            key={s.key}
            className={`flex items-center gap-2 rounded-chip px-1 ${active === s.key ? 'bg-chip' : ''}`}
            onPointerEnter={() => setActive(s.key)}
            onPointerLeave={() => setActive(null)}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: s.color }} aria-hidden />
            <span className="flex-1">{s.label}</span>
            <span className="tnum font-bold">{total ? Math.round((s.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
