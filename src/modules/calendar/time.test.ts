// Calendar times, work hours and overlap lanes. Run with: npm test
import { clampDay, duration, hhmm, itemsFor, lanes, snap15, toMin, workFor } from './time.ts';
import type { Block, WorkRow } from './types.ts';

let failures = 0;
const check = (name: string, ok: boolean, detail: unknown = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail !== '' ? ` - ${JSON.stringify(detail)}` : ''}`);
  if (!ok) failures++;
};
const meta = { created_at: '', updated_at: '' };

// Formatting and snapping.
check('hhmm', hhmm(570) === '09:30' && hhmm(360) === '06:00', hhmm(570));
check('toMin', toMin('09:30') === 570 && toMin('23:00') === 1380);
check('snap15 rounds to the nearest quarter', snap15(547) === 540 && snap15(553) === 555);
check('clampDay keeps a block inside 06:00-23:00', clampDay(300) === 360 && clampDay(1400, 60) === 1320);
check('duration', duration(90) === '1h 30m' && duration(60) === '1h' && duration(45) === '45m');

// Work hours. 2026-10-26 is a Monday, 2026-10-31 a Saturday.
const MON = '2026-10-26';
const SAT = '2026-10-31';
check('weekday without rows uses 9-5', JSON.stringify(workFor([], MON)) === JSON.stringify({ start_min: 540, end_min: 1020, custom: false }), workFor([], MON));
check('weekend has no work by default', workFor([], SAT) === null);
const usual: WorkRow = { id: 'u', ...meta, kind: 'usual', start_min: 480, end_min: 960 };
check('usual hours apply on weekdays', workFor([usual], MON)?.start_min === 480 && workFor([usual], MON)?.end_min === 960);
const monLate: WorkRow = { id: 'd1', ...meta, kind: 'day', date: MON, start_min: 600, end_min: 1080, off: false };
check('a day row beats the usual hours', workFor([usual, monLate], MON)?.start_min === 600 && workFor([usual, monLate], MON)?.custom === true);
const monOff: WorkRow = { id: 'd2', ...meta, kind: 'day', date: MON, start_min: 0, end_min: 0, off: true };
check('not working this day', workFor([usual, monOff], MON) === null);
const satWork: WorkRow = { id: 'd3', ...meta, kind: 'day', date: SAT, start_min: 600, end_min: 840, off: false };
check('work added on a weekend', workFor([satWork], SAT)?.start_min === 600);
check('a day row only affects its date', workFor([monOff], '2026-10-27')?.start_min === 540);

// Items on a day.
const block = (id: string, date: string, s: number, e: number): Block => ({
  id,
  ...meta,
  date,
  start_min: s,
  end_min: e,
  kind: 'bucket',
  bucket_id: 'b',
  task_id: null,
  task_title: null,
  template_id: null,
  template_name: null,
  google_event_id: null
});
const items = itemsFor(MON, [block('a', MON, 1080, 1140), block('x', SAT, 600, 660)], []);
check('itemsFor: the day\'s blocks plus work', items.length === 2 && items.some((i) => i.type === 'work' && i.id === `work|${MON}`), items.map((i) => i.id));
check('itemsFor: weekend without work has only blocks', itemsFor(SAT, [block('x', SAT, 600, 660)], []).length === 1);

// Lanes.
const L = lanes([
  { id: 'w', start: 540, end: 1020 },
  { id: 'a', start: 600, end: 660 },
  { id: 'b', start: 630, end: 690 },
  { id: 'c', start: 1080, end: 1140 }
]);
const by = (id: string) => L.find((x) => x.id === id)!;
check('overlapping items share a group of lanes', by('w').lanes === 3 && by('a').lanes === 3 && by('b').lanes === 3, L);
check('each overlapping item gets its own lane', new Set([by('w').lane, by('a').lane, by('b').lane]).size === 3);
check('a later, separate item has the full width', by('c').lanes === 1 && by('c').lane === 0);
const L2 = lanes([
  { id: 'p', start: 540, end: 600 },
  { id: 'q', start: 600, end: 660 }
]);
check('touching items do not overlap', L2.every((x) => x.lanes === 1), L2);
const L3 = lanes([
  { id: 'w', start: 540, end: 1020 },
  { id: 'a', start: 600, end: 660 },
  { id: 'b', start: 700, end: 760 }
]);
check('a freed lane is reused', L3.find((x) => x.id === 'b')!.lane === 1 && L3.every((x) => x.lanes === 2), L3);

if (failures) {
  console.error(`\n${failures} calendar check(s) failed`);
  process.exit(1);
}
console.log('\nAll calendar checks passed');
