// Extracts the authoritative, deterministic `verifiedFacts` payload that n8n's
// writer interprets. These are computed chart facts ONLY — never prose. n8n must
// never alter these; the app is the source of truth for the numbers.
import { computeChart, type ChartData } from '@/lib/chartEngine';
import { computeTransitBodies } from '@/lib/transit';

export interface BirthInfo {
  name?: string;
  date: string;
  time?: string;
  location: string;
  unknownTime?: boolean;
  latitude?: number;
  longitude?: number;
  planets?: unknown[];
}

function chartToFacts(chart: ChartData) {
  const planets = chart.planets.map((p) => ({
    key: p.key, label: p.label, longitude: round2(p.longitude),
    sign: p.sign, signLabel: p.signLabel, house: p.house,
    retrograde: p.retrograde, dignity: p.dignity,
  }));
  const houses = chart.houses.map((h) => ({
    num: h.num, cuspLongitude: round2(h.cuspLongitude), sign: h.sign, signLabel: h.signLabel,
  }));
  return {
    ascendant: { sign: chart.ascendant.sign, signLabel: chart.ascendant.signLabel, longitude: round2(chart.ascendant.longitude) },
    midheaven: { sign: chart.midheaven.sign, signLabel: chart.midheaven.signLabel, longitude: round2(chart.midheaven.longitude) },
    planets, houses,
  };
}

function round2(n: number) { return Math.round(n * 100) / 100; }

/** Build verifiedFacts for a pipeline report type from the saved birth info. */
export async function extractVerifiedFacts(
  contractType: string,
  birth: BirthInfo,
): Promise<Record<string, unknown>> {
  const chart = await computeChart({
    name: birth.name || 'Seeker', date: birth.date, time: birth.time,
    location: birth.location, unknownTime: !!birth.unknownTime,
  });
  const base = {
    birthDate: birth.date,
    birthTime: birth.time ?? null,
    place: birth.location,
    unknownTime: !!birth.unknownTime,
    natalChart: chartToFacts(chart),
  };
  if (contractType === 'yearlytransit') {
    const jd = Math.floor(Date.now() / 86400000) + 2440587.5; // today's JD, coarse is fine for facts
    const bodies = await computeTransitBodies(jd);
    return {
      ...base,
      transitSnapshot: bodies.map((b) => ({
        key: b.key, label: b.label, longitude: round2(b.longitude), sign: b.sign, degreeInSign: b.degreeInSign, retrograde: b.retrograde,
      })),
    };
  }
  return base;
}
