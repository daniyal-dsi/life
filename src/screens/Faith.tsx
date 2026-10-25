import { useState } from 'react';
import { BookOpen, HandHeart, Sunrise } from 'lucide-react';
import MihrabFrame, { StarMedallion } from '@/components/MihrabFrame';
import { EmptyState, Segmented } from '@/components/ui';
import { formatLong } from '@/lib/date';

// Step 1 placeholder inside the mihrab frame. Prayer times and logging,
// Quran and duas are step 7.

type View = 'prayers' | 'quran' | 'duas';

const PRAYERS = [
  { en: 'Fajr', ar: 'الفجر' },
  { en: 'Zuhr', ar: 'الظهر' },
  { en: 'Asr', ar: 'العصر' },
  { en: 'Maghrib', ar: 'المغرب' },
  { en: 'Isha', ar: 'العشاء' }
];

function hijriDate(d: Date): string {
  try {
    const s = new Intl.DateTimeFormat('en-GB-u-ca-islamic-umalqura', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(d);
    return `${s.replace(/\s?AH$/, '')} AH`;
  } catch {
    return '';
  }
}

export default function FaithScreen() {
  const [view, setView] = useState<View>('prayers');
  const today = new Date();

  return (
    <MihrabFrame>
      <section className="flex flex-col items-center gap-1 text-center">
        <p className="text-[11px] font-bold tracking-[0.1em] text-gold-ink">{hijriDate(today).toUpperCase()}</p>
        <p className="mt-1 font-arabic text-[28px] font-bold leading-[1.7] text-faith-ink" lang="ar" dir="rtl">
          بِسْمِ ٱللَّٰهِ
        </p>
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">Next prayer</p>
        <p className="disp mt-2 text-[40px] text-mh-time">Not set yet</p>
        <p className="mt-1 text-[14px] font-medium text-muted">Prayer times arrive in step 7</p>
      </section>

      <Segmented
        label="Faith section"
        options={[
          { id: 'prayers', label: 'Prayers' },
          { id: 'quran', label: 'Quran' },
          { id: 'duas', label: 'Duas' }
        ]}
        value={view}
        onChange={setView}
        activeClass="bg-faith text-white"
      />

      {view === 'prayers' && (
        <section className="rounded-card border border-line bg-surface py-1">
          <p className="px-4 pb-1 pt-2 text-[13px] font-semibold text-muted">{formatLong(today)}</p>
          {PRAYERS.map((p, i) => (
            <div key={p.en}>
              {i === 1 && (
                <div className="flex items-center gap-1.5 border-t border-line py-1 pl-[60px] pr-4 text-[13px] font-semibold text-gold-ink">
                  <Sunrise size={14} aria-hidden />
                  Sunrise · Fajr ends
                </div>
              )}
              <div className="flex items-center gap-3 border-t border-line py-3 pl-3 pr-4 first:border-t-0">
                <StarMedallion status="upcoming" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[16px] font-extrabold">{p.en}</span>
                    <span className="font-arabic text-[18px] text-faith-ink" lang="ar" dir="rtl">
                      {p.ar}
                    </span>
                  </div>
                  <p className="tnum text-[13px] text-muted">Time not set</p>
                </div>
                <span className="rounded-chip bg-chip px-2 py-1 text-[12px] font-extrabold text-muted">Later</span>
              </div>
            </div>
          ))}
        </section>
      )}
      {view === 'quran' && (
        <EmptyState
          icon={BookOpen}
          tone="faith"
          title="No recitations yet"
          body="Log surahs and verses, with rukus worked out for you. Arrives in step 7."
        />
      )}
      {view === 'duas' && (
        <EmptyState
          icon={HandHeart}
          tone="faith"
          title="No duas yet"
          body="A shared dua library with a tap counter for each. Arrives in step 7."
        />
      )}
    </MihrabFrame>
  );
}
