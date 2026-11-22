import { useState } from 'react';
import { BookOpen, HandHeart } from 'lucide-react';
import MihrabFrame from '@/components/MihrabFrame';
import { EmptyState, Notice, Segmented } from '@/components/ui';
import { hijri } from '@/modules/faith/format';
import type { PrayerTarget } from '@/modules/faith/PrayerSheet';
import Prayers, { PrayerHero, usePrayerClock } from '@/modules/faith/Prayers';
import { FaithProvider, useFaith } from '@/modules/faith/store';

// Faith: Prayers (step 7a), Quran (7c) and Duas (7d), every page inside the
// mihrab frame.

type View = 'prayers' | 'quran' | 'duas';

export default function FaithScreen() {
  return (
    <FaithProvider>
      <Faith />
    </FaithProvider>
  );
}

function Faith() {
  const { loading, error } = useFaith();
  const [view, setView] = useState<View>('prayers');
  const [sheet, setSheet] = useState<PrayerTarget | null>(null);
  const now = usePrayerClock();

  return (
    <MihrabFrame>
      {view === 'prayers' && !loading ? (
        <PrayerHero now={now} onLog={setSheet} />
      ) : (
        <section className="flex flex-col items-center gap-1 text-center">
          <p className="text-[11px] font-bold tracking-[0.1em] text-gold-ink">{hijri(new Date()).toUpperCase()}</p>
          <p className="mt-1 font-arabic text-[28px] font-bold leading-[1.7] text-faith-ink" lang="ar" dir="rtl">
            بِسْمِ ٱللَّٰهِ
          </p>
        </section>
      )}

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

      {error && <Notice tone="rose">{error}</Notice>}
      {view === 'prayers' && !loading && <Prayers now={now} sheet={sheet} setSheet={setSheet} />}
      {view === 'quran' && (
        <EmptyState icon={BookOpen} tone="faith" title="No recitations yet" body="Log surahs and verses, with rukus worked out for you. Coming in the next Faith step." />
      )}
      {view === 'duas' && (
        <EmptyState icon={HandHeart} tone="faith" title="No duas yet" body="A shared dua library with a tap counter for each. Coming after the Quran log." />
      )}
    </MihrabFrame>
  );
}
