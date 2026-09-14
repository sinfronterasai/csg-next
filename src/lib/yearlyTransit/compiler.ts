import type { ChartData } from '@/lib/chartEngine';
import { buildRollingUtcPeriod } from './period';
import { validateKnownTimeBirth } from './policy';
import { scanTransitWindows } from './engine';
import { createSwissTransitEvaluator } from './swissEvaluator';
import { enumerateEclipses } from './eclipses';
import { buildYearlyTransitFactPack } from './factPack';
import type { ImmutableSnapshotInput, NatalTarget, NatalTargetObservation, TransitObservation, YearlyTransitFactPack } from './types';

const TARGETS: NatalTarget[] = ['sun','moon','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto','asc','mc','northnode','chiron'];

function natalAnchors(chart: ChartData): NatalTargetObservation[] {
  const anchors: NatalTargetObservation[] = [];
  for (const key of TARGETS) {
    const placement = key === 'asc' ? chart.ascendant : key === 'mc' ? chart.midheaven : chart.planets.find((planet) => planet.key === key);
    if (!placement) throw new Error(`missing required natal target: ${key}`);
    const house = key === 'asc' ? 1 : key === 'mc' ? 10 : (placement as unknown as { house: number | null }).house;
    anchors.push({ key, label: placement.label, longitude: placement.longitude, house, source: key === 'asc' || key === 'mc' ? 'derived-deterministic' : 'swiss-ephemeris', factId: `natal.${key}.position` });
  }
  return anchors;
}

export async function compileYearlyTransit(input: { chart: ChartData; snapshot: ImmutableSnapshotInput; fromDate: string; junoMovingBody?: boolean }): Promise<YearlyTransitFactPack> {
  validateKnownTimeBirth({ date: input.chart.birth.date, time: input.chart.birth.time, unknownTime: input.chart.birth.unknownTime });
  if (input.junoMovingBody) throw new Error('moving Juno is not enabled in yearly-transit v1');
  const period = buildRollingUtcPeriod(input.fromDate, input.snapshot.birthData.timezone);
  const natal = natalAnchors(input.chart);
  const evaluator = createSwissTransitEvaluator();
  const scan = await scanTransitWindows({ fromUtc: period.fromUtc, toUtc: period.toUtc, evaluator, natal });
  const observations: TransitObservation[] = [];
  for (const body of ['sun','moon','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto'] as const) {
    const point = await evaluator.evaluate(body, Date.parse(period.fromUtc));
    observations.push({ body, longitude: point.longitude, retrograde: point.retrograde, calculationUtc: period.fromUtc, precision: 'exact-ephemeris', factId: `transit.${body}.${period.fromUtc}` });
  }
  const eclipses = await enumerateEclipses({ fromUtc: period.fromUtc, toUtc: period.toUtc, natal });
  return buildYearlyTransitFactPack({ snapshot: input.snapshot, period, displayTimezone: input.snapshot.birthData.timezone, natalTargets: natal, observations, windows: scan, eclipses, scoring: { chartRuler: undefined } });
}
