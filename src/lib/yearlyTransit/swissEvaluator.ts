import { Constants } from '@fusionstrings/swiss-eph';
import { getEph, PLANET_BODIES } from '@/lib/chartEngine';
import { dateToJulianDay } from '@/lib/transit';
import type { MovingBody } from './types';
import type { EnginePoint, TransitEvaluator } from './engine';

const FLAGS = Constants.SEFLG_SWIEPH | Constants.SEFLG_TROPICAL | Constants.SEFLG_SPEED;
const bodyConstant = new Map(PLANET_BODIES.filter((body) => body.key !== 'chiron' && body.key !== 'juno').map((body) => [body.key as MovingBody, body.se]));

export function createSwissTransitEvaluator(): TransitEvaluator {
  return {
    async evaluate(body: MovingBody, utcMs: number): Promise<EnginePoint> {
      const se = bodyConstant.get(body);
      if (se === undefined) throw new Error(`unsupported Swiss transit body: ${body}`);
      const eph = await getEph();
      const result = eph.swe_calc_ut(dateToJulianDay(new Date(utcMs)), se, FLAGS);
      if (result.returnCode < 0 || !Array.from(result.xx).every(Number.isFinite)) {
        throw new Error(`Swiss Ephemeris failed for ${body} at ${new Date(utcMs).toISOString()}`);
      }
      return { longitude: result.xx[0], retrograde: result.xx[3] < 0 };
    },
  };
}
