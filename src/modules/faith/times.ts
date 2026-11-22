// Calculated prayer times, ported from the approved prototype: the standard
// sun-position formulas (as in PrayTimes), with Fajr at 18°, Isha at 17°,
// standard or Hanafi Asr, and the angle-based high-latitude rule (Fajr no
// earlier than 18/60 of the night before sunrise, Isha no later than 17/60
// after sunset) for summers in the UK. No dependencies, so Node can test it.

export type Asr = 'standard' | 'hanafi';
export type Place = { lat: number; lng: number };
/** Minutes after local midnight. */
export type DayTimes = { fajr: number; sunrise: number; zuhr: number; asr: number; maghrib: number; isha: number };

const rad = Math.PI / 180;
const sind = (x: number) => Math.sin(x * rad);
const cosd = (x: number) => Math.cos(x * rad);
const tand = (x: number) => Math.tan(x * rad);
const asind = (x: number) => Math.asin(x) / rad;
const acosd = (x: number) => Math.acos(x) / rad;
const atan2d = (y: number, x: number) => Math.atan2(y, x) / rad;
const fixA = (a: number) => ((a % 360) + 360) % 360;
const fixH = (h: number) => ((h % 24) + 24) % 24;

const cache = new Map<string, DayTimes>();

/** Times for a local date (YYYY-MM-DD), in the device's time zone (UK). */
export function calcTimes(date: string, place: Place, asr: Asr = 'standard'): DayTimes {
  const key = `${date}|${place.lat}|${place.lng}|${asr}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const [y, m, d] = date.split('-').map(Number);
  const { lat, lng } = place;
  const tz = -new Date(y, m - 1, d, 12).getTimezoneOffset() / 60;
  const jd = Date.UTC(y, m - 1, d, 12) / 864e5 + 2440587.5 - lng / 360;
  const n = jd - 2451545;

  // Sun position.
  const g = fixA(357.529 + 0.98560028 * n);
  const q = fixA(280.459 + 0.98564736 * n);
  const L = fixA(q + 1.915 * sind(g) + 0.02 * sind(2 * g));
  const e = 23.439 - 0.00000036 * n;
  const ra = atan2d(cosd(e) * sind(L), cosd(L)) / 15;
  const eqt = q / 15 - fixH(ra);
  const dec = asind(sind(e) * sind(L));
  const noon = 12 + tz - lng / 15 - eqt;

  /** Hours from noon until the sun is `angle` degrees below the horizon. */
  const T = (angle: number) => acosd((-sind(angle) - sind(dec) * sind(lat)) / (cosd(dec) * cosd(lat))) / 15;
  const sunrise = noon - T(0.833);
  const sunset = noon + T(0.833);
  let fajr = noon - T(18);
  let isha = noon + T(17);
  const shadow = asr === 'hanafi' ? 2 : 1;
  const asrH = noon + acosd((sind(Math.atan(1 / (shadow + tand(Math.abs(lat - dec)))) / rad) - sind(dec) * sind(lat)) / (cosd(dec) * cosd(lat))) / 15;

  // High latitudes: twilight may never reach 18° or 17°.
  const night = 24 - (sunset - sunrise);
  if (Number.isNaN(fajr) || sunrise - fajr > (18 / 60) * night) fajr = sunrise - (18 / 60) * night;
  if (Number.isNaN(isha) || isha - sunset > (17 / 60) * night) isha = sunset + (17 / 60) * night;

  const M = (h: number) => Math.round(h * 60);
  const out: DayTimes = { fajr: M(fajr), sunrise: M(sunrise), zuhr: M(noon) + 1, asr: M(asrH), maghrib: M(sunset) + 1, isha: M(isha) };
  cache.set(key, out);
  return out;
}
