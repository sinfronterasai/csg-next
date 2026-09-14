import { Constants } from '@fusionstrings/swiss-eph';
import { getEph, normDeg } from '@/lib/chartEngine';
import { dateToJulianDay } from '@/lib/transit';
import type { EclipseEvidence, NatalTarget } from './types';
import { ECLIPSE_PROXIMITY_DEG } from './versions';
import type { NatalAnchor } from './engine';

const FLAGS = Constants.SEFLG_SWIEPH | Constants.SEFLG_TROPICAL;
const ALL_TYPES = 0;
const DAY_MS = 86_400_000;
const TARGET_KEYS: NatalTarget[] = ['sun','moon','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto','asc','mc','northnode','chiron'];

function angularDistance(a: number, b: number): number {
  const d = Math.abs(normDeg(a) - normDeg(b));
  return Math.min(d, 360 - d);
}

export async function enumerateEclipses(input: { fromUtc: string; toUtc: string; natal: readonly NatalAnchor[] }): Promise<EclipseEvidence[]> {
  const from = Date.parse(input.fromUtc); const to = Date.parse(input.toUtc);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from > to) throw new Error('invalid eclipse interval');
  const eph = await getEph();
  const out: EclipseEvidence[] = [];
  for (const kind of ['solar', 'lunar'] as const) {
    let cursor = from;
    while (cursor <= to) {
      const result = kind === 'solar'
        ? eph.swe_sol_eclipse_when_glob(dateToJulianDay(new Date(cursor)), FLAGS, ALL_TYPES, false)
        : eph.swe_lun_eclipse_when(dateToJulianDay(new Date(cursor)), FLAGS, ALL_TYPES, false);
      if (result.returnCode < 0 || !Array.from(result.tret).every(Number.isFinite)) throw new Error(`Swiss eclipse search failed for ${kind}`);
      const eventJd = result.tret[0];
      if (!Number.isFinite(eventJd)) throw new Error(`Swiss eclipse search returned no ${kind} event`);
      const eventMs = (eventJd - 2440587.5) * DAY_MS;
      if (eventMs > to) break;
      if (eventMs < cursor - 60_000) { cursor += 32 * DAY_MS; continue; }
      if (eventMs >= from && eventMs <= to) {
        const sun = eph.swe_calc_ut(eventJd, Constants.SE_SUN, FLAGS);
        if (sun.returnCode < 0 || !Number.isFinite(sun.xx[0])) throw new Error(`Swiss Sun longitude failed at eclipse`);
        const axisLongitude = normDeg(sun.xx[0]);
        const proximityByTarget = {} as Record<NatalTarget, number>;
        let axisContact: 'axisA' | 'axisB' = 'axisA';
        for (const key of TARGET_KEYS) {
          const anchor = input.natal.find((n) => n.key === key);
          const a = anchor ? angularDistance(anchor.longitude, axisLongitude) : 180;
          const b = anchor ? angularDistance(anchor.longitude, axisLongitude + 180) : 180;
          proximityByTarget[key] = Math.min(a, b);
          if (a <= ECLIPSE_PROXIMITY_DEG && a <= b) axisContact = 'axisA';
          else if (b <= ECLIPSE_PROXIMITY_DEG && b < a) axisContact = 'axisB';
        }
        out.push({ id: `yt.eclipse.${kind}.${Math.round(eventMs / 1000)}`, type: kind, exactUtc: new Date(Math.round(eventMs / 1000) * 1000).toISOString(), axisLongitude,
          axisContact, proximityByTarget, source: 'swiss-eclipse-api', flags: result.returnCode, precision: 'exact-ephemeris', policyVersion: 'yt-eclipse-swiss-v1.0.0', factId: '' });
      }
      cursor = eventMs + 60_000;
    }
  }
  const unique = new Map(out.map((e) => [`${e.type}:${e.exactUtc}`, e]));
  return [...unique.values()].sort((a, b) => a.exactUtc.localeCompare(b.exactUtc) || a.type.localeCompare(b.type));
}
