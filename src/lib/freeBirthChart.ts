import type { VerifiedFactsV2, VerifiedFact, PositionValue } from './reportFacts/types';

const FREE_BODIES = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'chiron', 'juno'] as const;

type FreePlacement = {
  key: string;
  body: string;
  sign: string;
  degree: string;
  house: string;
  retrograde: string;
};

export type FreeBirthChartReport = {
  schemaVersion: 'csg-free-birth-chart-v1';
  asOfDate: string;
  placements: FreePlacement[];
  tables: { planets: FreePlacement[] };
  angles: { body: string; sign: string; degree: string }[];
  houses: { house: number; sign: string }[];
};

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_TIME = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

export type FreeBirthInput = {
  date: string;
  time?: string;
  location: string;
  timezone?: string;
  latitude?: number;
  longitude?: number;
  unknownTime?: boolean;
};

export function validateFreeBirthInput(input: FreeBirthInput):
  | { ok: true; value: FreeBirthInput }
  | { ok: false; error: string } {
  if (!input || typeof input !== 'object') return { ok: false, error: 'birth input is required' };
  const dateMatch = typeof input.date === 'string' && ISO_DATE.exec(input.date);
  if (!dateMatch) return { ok: false, error: 'date must be YYYY-MM-DD' };
  const date = new Date(Date.UTC(+dateMatch[1], +dateMatch[2] - 1, +dateMatch[3]));
  if (date.getUTCFullYear() !== +dateMatch[1] || date.getUTCMonth() !== +dateMatch[2] - 1 || date.getUTCDate() !== +dateMatch[3]) {
    return { ok: false, error: 'date is not a real calendar date' };
  }
  if (typeof input.location !== 'string' || !input.location.trim()) return { ok: false, error: 'location is required' };
  if (!input.unknownTime && (typeof input.time !== 'string' || !ISO_TIME.test(input.time))) return { ok: false, error: 'time must be HH:mm unless unknownTime is set' };
  if ((input.latitude === undefined) !== (input.longitude === undefined)) return { ok: false, error: 'latitude and longitude must be supplied together' };
  if (input.latitude !== undefined && (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude) || Math.abs(input.latitude) > 90 || Math.abs(input.longitude!) > 180)) return { ok: false, error: 'coordinates are out of range' };
  if (input.timezone !== undefined) {
    try { new Intl.DateTimeFormat('en', { timeZone: input.timezone }); } catch { return { ok: false, error: 'timezone must be a valid IANA timezone' }; }
  }
  return { ok: true, value: { ...input, location: input.location.trim() } };
}

function positionMap(ledger: VerifiedFactsV2): Map<string, VerifiedFact> {
  if (ledger.schemaVersion !== 'csg-report-facts-v2' || ledger.reportType !== 'natal') throw new Error('invalid verified natal ledger');
  const map = new Map<string, VerifiedFact>();
  for (const fact of ledger.common.positions) {
    if (fact.kind !== 'position') continue;
    const value = fact.value as PositionValue;
    if (!value || !FREE_BODIES.includes(value.key as typeof FREE_BODIES[number])) continue;
    if (fact.source !== 'swiss-ephemeris') throw new Error(`invalid authoritative position ${fact.id}`);
    if (map.has(value.key)) throw new Error(`duplicate position ${value.key}`);
    if (fact.id !== `natal.${value.key}.position`) throw new Error(`non-canonical position id ${fact.id}`);
    if (!Number.isFinite(value.longitude) || !Number.isFinite(value.degreeInSign) || !value.signLabel || !value.label) throw new Error(`invalid position ${value.key}`);
    map.set(value.key, fact);
  }
  for (const key of FREE_BODIES) if (!map.has(key)) throw new Error(`missing position ${key}`);
  return map;
}

function displayDegree(value: PositionValue): string { return `${value.degreeInSign.toFixed(2)}°`; }

export function compileFreeBirthChart(ledger: VerifiedFactsV2): FreeBirthChartReport {
  const positions = positionMap(ledger);
  const placements = FREE_BODIES.map((key) => {
    const value = positions.get(key)!.value as PositionValue;
    return { key, body: value.label, sign: value.signLabel, degree: displayDegree(value), house: value.house === null ? '—' : String(value.house), retrograde: value.retrograde ? 'Retrograde' : 'Direct' };
  });
  const angles = [ledger.common.ascendant, ledger.common.midheaven].filter(Boolean).map((value) => ({ body: value!.label, sign: value!.signLabel, degree: displayDegree(value!) }));
  const houses = (ledger.common.houses ?? []).map((house) => ({ house: house.num, sign: house.signLabel }));
  return { schemaVersion: 'csg-free-birth-chart-v1', asOfDate: ledger.asOfDate, placements, tables: { planets: placements }, angles, houses };
}
