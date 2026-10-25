import { useId, type ReactNode } from 'react';

// Full-page mihrab (prayer niche) frame for every Faith page: a pointed arch
// with a star finial and hanging lamp, emerald spandrels with a faint
// eight-point star pattern, gold capitals, and double gold lines running down
// both sides to the bottom of the page, with gold beads on the side bands.

const gold = 'rgb(var(--gold))';
const goldHi = 'rgb(var(--gold-hi))';

/** Path for an eight-point star centred on (cx, cy). */
export function star8(cx: number, cy: number, R: number, r: number): string {
  let d = '';
  for (let i = 0; i < 16; i++) {
    const a = ((-90 + i * 22.5) * Math.PI) / 180;
    const rr = i % 2 ? r : R;
    d += `${i ? 'L' : 'M'}${(cx + rr * Math.cos(a)).toFixed(2)} ${(cy + rr * Math.sin(a)).toFixed(2)}`;
  }
  return `${d}Z`;
}

const APEX = star8(195, 13, 7, 4.2);
const PATTERN_STAR = star8(15, 15, 7, 4.2);

/** Eight-point star medallion used on prayer rows. */
export function StarMedallion({
  status,
  size = 40
}: {
  status: 'ontime' | 'due' | 'missed' | 'upcoming';
  size?: number;
}) {
  const fill = status === 'ontime' ? 'rgb(var(--faith))' : 'rgb(var(--surface))';
  const stroke = {
    ontime: 'rgb(var(--faith))',
    due: gold,
    missed: 'rgb(var(--rose))',
    upcoming: 'rgb(var(--line2))'
  }[status];
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <path d={star8(20, 20, 19, 14.5)} fill={fill} stroke={stroke} strokeWidth={1.6} />
      {status === 'ontime' && (
        <path d="M13 20.5l5 5 9-10" fill="none" stroke={goldHi} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
      )}
      {status === 'due' && <circle cx={20} cy={20} r={4} fill={gold} />}
      {status === 'missed' && (
        <path d="M15 15l10 10M25 15L15 25" stroke="rgb(var(--rose))" strokeWidth={2.2} strokeLinecap="round" />
      )}
    </svg>
  );
}

export default function MihrabFrame({ children }: { children: ReactNode }) {
  const uid = useId().replace(/:/g, '');
  const starsId = `mh-stars-${uid}`;
  const beadsId = `mh-beads-${uid}`;

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-faith px-4 pb-4 lg:rounded-b-[28px]">
      {/* Spandrels: faint gold star pattern on emerald. */}
      <svg className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <pattern id={starsId} width={30} height={30} patternUnits="userSpaceOnUse">
            <path d={PATTERN_STAR} fill="none" stroke={goldHi} strokeOpacity={0.32} strokeWidth={1} />
          </pattern>
          <pattern id={beadsId} width={16} height={22} patternUnits="userSpaceOnUse">
            <path d="M8 8l3 3-3 3-3-3z" fill={gold} />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${starsId})`} />
      </svg>

      {/* Side bands with gold beads, from the capitals to the bottom. */}
      {(['left-0', 'right-0'] as const).map((side) => (
        <svg key={side} className={`absolute bottom-5 top-[240px] w-4 ${side}`} aria-hidden>
          <rect width="100%" height="100%" fill="rgb(var(--faith))" />
          <rect width="100%" height="100%" fill={`url(#${beadsId})`} />
        </svg>
      ))}

      {/* The arch: niche, double gold lines, finial, lamp and capitals. */}
      <svg
        className="absolute left-0 top-0 z-[1] block h-[236px] w-full"
        viewBox="0 0 390 236"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path d="M16 236C16 142 110 80 195 24C280 80 374 142 374 236Z" fill="rgb(var(--niche))" />
        <path
          d="M22 236C22 145.6 115.4 84.8 195 31.8C274.6 84.8 368 145.6 368 236"
          fill="none"
          stroke={gold}
          strokeWidth={1.6}
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M27 236C27 148.6 119.9 88.8 195 38.3C270.1 88.8 363 148.6 363 236"
          fill="none"
          stroke={gold}
          strokeOpacity={0.45}
          strokeWidth={0.8}
          vectorEffect="non-scaling-stroke"
        />
        <path d={APEX} fill={gold} />
        <path d="M195 39V57" stroke={gold} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
        <path d="M186 57h18l-3 9a6 6 0 01-12 0z" fill={gold} />
        <circle cx={195} cy={71} r={2.2} fill={gold} />
        <rect x={2} y={228} width={28} height={8} rx={2} fill={gold} />
        <rect x={360} y={228} width={28} height={8} rx={2} fill={gold} />
        <rect x={5} y={222} width={22} height={5} rx={2} fill={goldHi} />
        <rect x={363} y={222} width={22} height={5} rx={2} fill={goldHi} />
      </svg>

      {/* The niche, where the content sits. */}
      <div
        className="relative z-[2] flex flex-col gap-5 px-[18px] pb-[132px] pt-[92px] lg:pb-12"
        style={{ background: 'linear-gradient(to bottom, transparent 230px, rgb(var(--niche)) 230px)' }}
      >
        <div
          className="pointer-events-none absolute bottom-1.5 left-1.5 right-1.5 top-[234px] rounded-b-[18px] border-[1.6px] border-t-0 border-gold"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute bottom-[11px] left-[11px] right-[11px] top-[234px] rounded-b-[14px] border-[0.8px] border-t-0 border-gold opacity-[0.45]"
          aria-hidden
        />
        <div className="relative flex flex-col gap-5">{children}</div>
      </div>
    </div>
  );
}
