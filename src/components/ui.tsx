import { useEffect, useId, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Trophy, X, Zap, type LucideIcon } from 'lucide-react';

// Shared building blocks. Colours always come from the design tokens, so these
// work unchanged in light and dark themes.

export type Tone = 'coral' | 'green' | 'sun' | 'violet' | 'rose' | 'faith' | 'gold' | 'ink';

// Tailwind needs full class names in the source, so tones map to literal strings.
const toneText: Record<Tone, string> = {
  coral: 'text-coral',
  green: 'text-green',
  sun: 'text-sun',
  violet: 'text-violet',
  rose: 'text-rose',
  faith: 'text-faith',
  gold: 'text-gold',
  ink: 'text-ink'
};
const toneBg: Record<Tone, string> = {
  coral: 'bg-coral',
  green: 'bg-green',
  sun: 'bg-sun',
  violet: 'bg-violet',
  rose: 'bg-rose',
  faith: 'bg-faith',
  gold: 'bg-gold',
  ink: 'bg-ink'
};
const toneSoft: Record<Tone, string> = {
  coral: 'bg-coral-soft text-coral-ink',
  green: 'bg-green-soft text-green-ink',
  sun: 'bg-sun-soft text-sun-ink',
  violet: 'bg-violet-soft text-violet-ink',
  rose: 'bg-rose-soft text-rose-ink',
  faith: 'bg-faith-soft text-faith-ink',
  gold: 'bg-sun-soft text-gold-ink',
  ink: 'bg-chip text-ink'
};
const toneBorder: Record<Tone, string> = {
  coral: 'border-coral',
  green: 'border-green',
  sun: 'border-sun',
  violet: 'border-violet',
  rose: 'border-rose',
  faith: 'border-faith',
  gold: 'border-gold',
  ink: 'border-ink'
};

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

/* Page: standard padding for a screen; leaves room for the tab dock. */

export function Page({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-6 px-4 pb-[calc(120px+env(safe-area-inset-bottom))] lg:pb-12">{children}</div>;
}

/* Card */

export function Card({
  children,
  className,
  dark = false
}: {
  children: ReactNode;
  className?: string;
  dark?: boolean;
}) {
  return (
    <div
      className={cx(
        dark
          ? 'rounded-hero border border-[rgb(var(--hero-border))] bg-hero text-white'
          : 'rounded-card border border-line bg-surface',
        'p-4',
        className
      )}
    >
      {children}
    </div>
  );
}

/* Buttons */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'coral' | 'green' | 'sun' | 'violet';
  icon?: LucideIcon;
  full?: boolean;
};

export function Button({ variant = 'primary', icon: Icon, full = true, className, children, ...rest }: ButtonProps) {
  const styles = {
    primary: 'bg-btn text-btn-text',
    secondary: 'border border-line2 bg-surface text-ink',
    ghost: 'bg-transparent text-ink',
    danger: 'bg-rose-soft text-rose-ink',
    // Module colours, with dark text as in the mockups.
    coral: 'bg-coral text-hero',
    green: 'bg-green text-hero',
    sun: 'bg-sun text-hero',
    violet: 'bg-violet text-white'
  }[variant];
  return (
    <button
      type="button"
      className={cx(
        'inline-flex h-[52px] items-center justify-center gap-2 rounded-btn px-5 text-[15px] font-semibold transition-opacity active:opacity-80',
        full && 'w-full',
        styles,
        className
      )}
      {...rest}
    >
      {Icon && <Icon size={18} strokeWidth={2.2} aria-hidden />}
      {children}
    </button>
  );
}

export function IconButton({
  icon: Icon,
  label,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-btn border border-line bg-surface text-ink active:opacity-80',
        className
      )}
      {...rest}
    >
      <Icon size={18} strokeWidth={2.2} aria-hidden />
    </button>
  );
}

/* Header: small uppercase label above a big display title */

export function Header({ label, title, right }: { label: string; title: string; right?: ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-3 pb-5 pt-6">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{label}</p>
        <h1 className="disp mt-1 text-balance text-[30px] !leading-[1.05] !tracking-[-0.025em]">
          {title}
        </h1>
      </div>
      {right && <div className="flex shrink-0 gap-2">{right}</div>}
    </header>
  );
}

/* Tabs */

export type TabItem<T extends string> = { id: T; label: string; tone?: Tone };

export function UnderlineTabs<T extends string>({
  tabs,
  value,
  onChange
}: {
  tabs: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div role="tablist" className="flex gap-6 border-b border-line">
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={cx(
              '-mb-px border-b-[3px] pb-2.5 pt-0.5 text-[15px] transition-colors',
              active ? cx(toneBorder[t.tone ?? 'ink'], 'font-bold text-ink') : 'border-transparent font-semibold text-muted'
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  activeClass = 'bg-surface text-ink shadow-[0_1px_2px_rgb(0_0_0/0.08)]'
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  label?: string;
  /** Classes for the active pill; Faith uses an emerald pill. */
  activeClass?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-ctl bg-segbg p-1">
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.id)}
            className={cx(
              'h-9 flex-1 rounded-chip text-[14px] font-semibold transition-colors',
              active ? activeClass : 'text-muted'
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* Badges. PR (personal record) and the P1/P2/P3 priorities never share a colour. */

export type BadgeKind = 'PR' | 'P1' | 'P2' | 'P3';

export function Badge({ kind }: { kind: BadgeKind }) {
  if (kind === 'PR') {
    return (
      <span className="inline-flex h-[30px] shrink-0 items-center gap-1.5 rounded-chip bg-sun px-2.5 text-[13px] font-extrabold text-hero shadow-[var(--glow-sun)]">
        <Trophy size={13} strokeWidth={2.5} aria-hidden />
        PR
        <span className="sr-only"> personal record</span>
      </span>
    );
  }
  const styles = {
    P1: 'bg-rose text-surface',
    P2: 'bg-p2-bg text-p2-ink',
    P3: 'border-[1.5px] border-line2 text-muted'
  }[kind];
  return (
    <span
      className={cx('inline-flex h-[22px] shrink-0 items-center gap-1 rounded-[5px] px-2 text-[11px] font-extrabold', styles)}
    >
      {kind === 'P1' && <Zap size={10} fill="currentColor" strokeWidth={0} aria-hidden />}
      {kind}
      <span className="sr-only"> priority</span>
    </span>
  );
}

/* Progress */

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

export function ProgressBar({ value, tone = 'ink', label }: { value: number; tone?: Tone; label?: string }) {
  const v = clamp01(value);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
      className="h-2 w-full overflow-hidden rounded-full bg-chip"
    >
      <div className={cx('h-full rounded-full transition-[width]', toneBg[tone])} style={{ width: `${v * 100}%` }} />
    </div>
  );
}

export function ProgressRing({
  value,
  size = 64,
  stroke = 7,
  tone = 'ink',
  track = 'text-line',
  label,
  children
}: {
  value: number;
  size?: number;
  stroke?: number;
  tone?: Tone;
  track?: string;
  label?: string;
  children?: ReactNode;
}) {
  const v = clamp01(value);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} stroke="currentColor" className={track} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          stroke="currentColor"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          className={cx(toneText[tone], 'transition-[stroke-dashoffset]')}
        />
      </svg>
      {children && <div className="absolute inset-0 flex items-center justify-center">{children}</div>}
    </div>
  );
}

/* Tiles and cards */

export function StatTile({
  label,
  value,
  unit,
  tone = 'ink'
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  tone?: Tone;
}) {
  return (
    <div className="rounded-card border border-line bg-surface p-3.5">
      <div className="flex items-center gap-1.5">
        <span className={cx('h-2 w-2 rounded-full', toneBg[tone])} aria-hidden />
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">{label}</p>
      </div>
      <p className="disp tnum mt-2 text-[28px]">
        {value}
        {unit && <span className="ml-1 font-body text-[13px] font-semibold text-muted">{unit}</span>}
      </p>
    </div>
  );
}

export type ModuleTone = 'coral' | 'green' | 'sun' | 'violet';

const moduleClass: Record<ModuleTone, string> = {
  coral: 'k-coral',
  green: 'k-green',
  sun: 'k-sun',
  violet: 'k-violet'
};

/** Coloured module card: solid colour in light, tinted with a glowing number in dark. */
export function ModuleCard({
  to,
  icon: Icon,
  title,
  value,
  unit,
  progress,
  caption,
  tone
}: {
  to: string;
  icon: LucideIcon;
  title: string;
  value: ReactNode;
  unit?: string;
  progress: number;
  caption: string;
  tone: ModuleTone;
}) {
  return (
    <Link to={to} className={cx('kcard flex flex-col gap-3 rounded-card p-4 active:opacity-90', moduleClass[tone])}>
      <span className="flex items-center justify-between text-[14px]">
        <span className="flex items-center gap-2">
          <span className="kicon inline-flex h-[30px] w-[30px] items-center justify-center rounded-[9px]">
            <Icon size={16} strokeWidth={2.2} aria-hidden />
          </span>
          <b>{title}</b>
        </span>
        <ChevronRight size={16} aria-hidden />
      </span>
      <span className="flex flex-wrap items-baseline gap-1.5">
        <span className="disp knum tnum text-[38px]">{value}</span>
        {unit && <span className="text-[13px] font-semibold opacity-80">{unit}</span>}
      </span>
      <span className="ktrack block h-[5px] overflow-hidden rounded-[3px]">
        <span className="kbar block h-full rounded-[3px]" style={{ width: `${Math.max(2, clamp01(progress) * 100)}%` }} />
      </span>
      <span className="text-[12px] font-semibold opacity-85">{caption}</span>
    </Link>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  tone = 'ink',
  action
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  tone?: Tone;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-card border border-dashed border-line2 px-6 py-10 text-center">
      <span className={cx('flex h-12 w-12 items-center justify-center rounded-full', toneSoft[tone])}>
        <Icon size={22} strokeWidth={2.2} aria-hidden />
      </span>
      <p className="mt-3 text-[16px] font-semibold">{title}</p>
      <p className="mt-1 max-w-[280px] text-[14px] leading-relaxed text-muted">{body}</p>
      {action && <div className="mt-5 w-full max-w-[280px]">{action}</div>}
    </div>
  );
}

/* Bottom sheet */

export function BottomSheet({
  open,
  onClose,
  title,
  children
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="animate-sheet relative max-h-[90dvh] w-full max-w-[520px] overflow-y-auto rounded-t-[20px] bg-surface px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-3 shadow-[var(--shadow)]"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line2" aria-hidden />
        <div className="mb-4 flex items-center justify-between">
          <h2 id={titleId} className="disp text-[22px]">
            {title}
          </h2>
          <IconButton icon={X} label="Close" onClick={onClose} />
        </div>
        {children}
      </div>
    </div>
  );
}

/* Form field */

export function Field({
  label,
  hint,
  children
}: {
  label: string;
  hint?: string;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold text-muted">
        {label}
      </label>
      {children(id)}
      {hint && <p className="mt-1.5 text-[12px] text-muted">{hint}</p>}
    </div>
  );
}

export const inputClass =
  'h-[52px] w-full rounded-btn border border-line2 bg-surface px-4 text-[16px] text-ink placeholder:text-muted focus:border-ink focus:outline-none';

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="font-display text-[18px] font-bold tracking-[-0.015em]">{children}</h2>
      {right && <span className="text-[13px] text-muted">{right}</span>}
    </div>
  );
}

export function Notice({ tone = 'violet', children }: { tone?: 'violet' | 'rose' | 'green' | 'sun'; children: ReactNode }) {
  const styles = {
    violet: 'bg-violet-soft text-violet-ink',
    rose: 'bg-rose-soft text-rose-ink',
    green: 'bg-green-soft text-green-ink',
    sun: 'bg-sun-soft text-sun-ink'
  }[tone];
  return <div className={cx('rounded-btn px-3 py-2.5 text-[14px] font-medium', styles)}>{children}</div>;
}

/* Toggle switch */

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx('relative h-8 w-[52px] shrink-0 rounded-full transition-colors', checked ? 'bg-green' : 'bg-line2')}
    >
      <span
        className={cx(
          'absolute top-[3px] h-[26px] w-[26px] rounded-full bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.2)] transition-[left]',
          checked ? 'left-[23px]' : 'left-[3px]'
        )}
      />
    </button>
  );
}
