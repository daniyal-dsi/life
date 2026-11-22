// Faith: calculated times, prayer statuses and the mosque message parser. Run with: npm test
process.env.TZ = 'Europe/London';
import { parseMosque } from './parse.ts';
import { dayScore, duePrayer, judge, nextPrayer, shiftDate, status, windowsFor, type LogLike } from './score.ts';
import { calcTimes } from './times.ts';

let failures = 0;
const check = (name: string, ok: boolean, detail: unknown = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail !== '' ? ` - ${JSON.stringify(detail)}` : ''}`);
  if (!ok) failures++;
};
const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const near = (a: number, b: number, tol = 4) => Math.abs(a - b) <= tol;
const LONDON = { lat: 51.5074, lng: -0.1278 };
const TILFORD = { lat: 51.185, lng: -0.746 };

// Calculated times (London, published sunrise/sunset within a few minutes).
const nov = calcTimes('2026-11-22', LONDON);
check('November sunrise and sunset (GMT)', near(nov.sunrise, 7 * 60 + 31) && near(nov.maghrib, 16 * 60 + 4), Object.values(nov).map(hm));
check('November Zuhr just after solar noon', near(nov.zuhr, 11 * 60 + 50, 3), hm(nov.zuhr));
check('order: fajr < sunrise < zuhr < asr < maghrib < isha', nov.fajr < nov.sunrise && nov.sunrise < nov.zuhr && nov.zuhr < nov.asr && nov.asr < nov.maghrib && nov.maghrib < nov.isha);
const hanafi = calcTimes('2026-11-22', LONDON, 'hanafi');
check('Hanafi Asr is later than standard', hanafi.asr > nov.asr + 20, [hm(nov.asr), hm(hanafi.asr)]);
const jun = calcTimes('2026-06-21', LONDON);
check('June sunrise and sunset (BST)', near(jun.sunrise, 4 * 60 + 43) && near(jun.maghrib, 21 * 60 + 22), Object.values(jun).map(hm));
const night = 1440 - (jun.maghrib - 1 - jun.sunrise);
check('June Fajr uses the high-latitude rule', near(jun.fajr, jun.sunrise - (18 / 60) * night, 2), hm(jun.fajr));
check('June Isha uses the high-latitude rule', near(jun.isha, jun.maghrib - 1 + (17 / 60) * night, 2), hm(jun.isha));
check('Tilford differs from London by longitude', calcTimes('2026-11-22', TILFORD).zuhr > nov.zuhr);

// Windows and judging.
const D = '2026-11-18';
const w = windowsFor(D, LONDON, 'standard');
check('Isha window ends at the next Fajr', w.isha.e === calcTimes(shiftDate(D, 1), LONDON).fajr + 1440);
check('judge: on time, late, made up, early', judge({ s: 600, e: 700 }, 620) === 'ontime' && judge({ s: 600, e: 700 }, 660) === 'late' && judge({ s: 600, e: 700 }, 701) === 'qada' && judge({ s: 600, e: 700 }, 599) === 'early');
const log = (prayer: LogLike['prayer'], time: number, combined: LogLike['combined'] = null): LogLike => ({ date: D, prayer, time, combined });
check('logged on time', status(D, 'zuhr', w, log('zuhr', w.zuhr.s + 10), D, 0) === 'ontime');
check('combined Zuhr + Asr at Asr time is on time for Zuhr', status(D, 'zuhr', w, log('zuhr', w.asr.s + 10, 'asr'), D, 0) === 'ontime');
check('Zuhr alone at that time is made up', status(D, 'zuhr', w, log('zuhr', w.asr.s + 10), D, 0) === 'qada');
check('unlogged, before its time', status(D, 'asr', w, undefined, D, w.zuhr.s) === 'upcoming');
check('unlogged, in its window', status(D, 'asr', w, undefined, D, w.asr.s + 5) === 'now');
check('unlogged, last hour', status(D, 'asr', w, undefined, D, w.asr.e - 30) === 'lastHour');
check('unlogged, after its window', status(D, 'asr', w, undefined, D, w.asr.e + 1) === 'missed');
check('an earlier day unlogged is missed', status(shiftDate(D, -3), 'fajr', w, undefined, D, 0) === 'missed');
check("yesterday's Isha is still due after midnight", status(shiftDate(D, -1), 'isha', windowsFor(shiftDate(D, -1), LONDON, 'standard'), undefined, D, 60) === 'now');
check('Isha logged after midnight counts', status(D, 'isha', w, log('isha', 1440 + 30), D, 0) === 'ontime');
check('score: on time, half for late', JSON.stringify(dayScore(['ontime', 'ontime', 'late', 'missed', 'upcoming'], 3)) === JSON.stringify({ ontime: 2, late: 1, other: 1, logged: 3, pct: 50 }));

// Next and due prayers.
const tom = windowsFor(shiftDate(D, 1), LONDON, 'standard');
const y = windowsFor(shiftDate(D, -1), LONDON, 'standard');
check('next prayer during the morning is Zuhr', nextPrayer(D, 9 * 60, w, tom).prayer === 'zuhr');
check('after Isha starts, next is tomorrow Fajr', JSON.stringify(nextPrayer(D, w.isha.s + 5, w, tom)) === JSON.stringify({ date: shiftDate(D, 1), prayer: 'fajr', start: tom.fajr.s }));
const none = () => false;
check('due: Asr in its window', duePrayer(D, w.asr.s + 10, w, y, none)?.prayer === 'asr');
check('due: nothing once Asr is logged', duePrayer(D, w.asr.s + 10, w, y, (_d, p) => p === 'asr') === null);
check("due: yesterday's Isha at 01:00", duePrayer(D, 60, w, y, none)?.date === shiftDate(D, -1));

// Mosque messages.
const msg = `Assalamu Alaikum
Masjid Mubarak prayer timings from Monday 2nd November
Fajr 6:00am
Zuhr & Asr 1:15pm
Maghrib: Sunset
Isha 7:30pm
Jumu'ah 1:00pm`;
const p = parseMosque(msg, '2026-10-30');
check('parse: all prayers', JSON.stringify(p.times) === JSON.stringify({ fajr: '06:00', zuhr: '13:15', asr: '13:15', maghrib: 'sunset', isha: '19:30', jumuah: '13:00' }), p.times);
check('parse: from date', p.from === '2026-11-02', p.from);
const p24 = parseMosque('Fajr: 05.45\nDhuhr 13:30\nAsar 15:00\nMagrib 16:10\nEsha 18:45\nwef 9/11', '2026-11-05');
check('parse: 24 hour times and other spellings', JSON.stringify(p24.times) === JSON.stringify({ fajr: '05:45', zuhr: '13:30', asr: '15:00', maghrib: '16:10', isha: '18:45' }), p24);
check('parse: numeric from date', p24.from === '2026-11-09', p24.from);
const bare = parseMosque('Zuhr 1:30\nAsr 3:15\nIsha 8:00\nFajr 5:15', '2026-11-05');
check('parse: am or pm guessed from the prayer', JSON.stringify(bare.times) === JSON.stringify({ zuhr: '13:30', asr: '15:15', isha: '20:00', fajr: '05:15' }), bare.times);
const oneLine = parseMosque('Fajr 6:15am | Zuhr 12:45pm | Asr 2:30pm | Isha 7pm', '2026-11-05');
check('parse: one line with separators, "7pm"', JSON.stringify(oneLine.times) === JSON.stringify({ fajr: '06:15', zuhr: '12:45', asr: '14:30', isha: '19:00' }), oneLine.times);
check('parse: from date in January read as next year', parseMosque('From 4th January', '2026-12-20').from === '2027-01-04');
check('parse: nothing found', Object.keys(parseMosque('See you all at the jalsa!', '2026-11-05').times).length === 0);

if (failures) {
  console.error(`\n${failures} faith check(s) failed`);
  process.exit(1);
}
console.log('\nAll faith checks passed');
