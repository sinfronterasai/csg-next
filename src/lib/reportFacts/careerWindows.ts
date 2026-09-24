import crypto from 'crypto';
import { computeChart, geocodeLocation, type ChartData } from '@/lib/chartEngine';
import { buildRollingUtcPeriodMonths } from '@/lib/yearlyTransit/period';
import { validateKnownTimeBirth } from '@/lib/yearlyTransit/policy';
import { scanTransitWindows } from '@/lib/yearlyTransit/engine';
import { createSwissTransitEvaluator } from '@/lib/yearlyTransit/swissEvaluator';
import type { ActiveWindow, NatalTarget } from '@/lib/yearlyTransit/types';
import type { BirthInput } from './build';
import type { VerifiedFact } from './types';

export const VOCATION_CAREER_WINDOW_VERSION = 'csg-vocation-career-windows-v1';
const MOVERS = ['jupiter', 'saturn'] as const;
const ASPECTS = ['conjunction', 'sextile', 'square', 'trine', 'opposition'] as const;

export interface VocationMonthBucket { key: string; startLocal: string; endLocal: string; windowIds: string[] }
export interface VocationCareerWindow {
  id: string; mover: string; target: string; aspect: string; passIndex: number;
  activeWindow: { startUtc: string; endUtc: string }; exactHits: ActiveWindow['exactHits'];
  segments: ActiveWindow['segments']; retrograde: boolean; direction: string;
  score: number; evidenceIds: string[]; localStart: string; localEnd: string;
}
export interface VocationCareerWindowPack {
  schemaVersion: typeof VOCATION_CAREER_WINDOW_VERSION;
  generatedLocalDate: string; displayTimezone: string;
  period: { fromUtc: string; toUtc: string };
  movers: readonly string[]; targets: readonly string[]; orbPolicy: Record<string, number>;
  months: VocationMonthBucket[]; windows: VocationCareerWindow[];
  facts: Record<string, VerifiedFact>; canonicalWindowHash: string;
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value as object).sort().map(k => `${JSON.stringify(k)}:${stable((value as any)[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
function localDate(utc: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(utc));
}
function monthBuckets(start: string, timezone: string, windows: VocationCareerWindow[]): VocationMonthBucket[] {
  const [y, m] = start.split('-').map(Number);
  return Array.from({ length: 24 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 + i, 1));
    const next = new Date(Date.UTC(y, m - 1 + i + 1, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const ids = windows.filter(w => w.localStart.slice(0, 7) <= key && w.localEnd.slice(0, 7) >= key).map(w => w.id);
    return { key, startLocal: `${key}-01`, endLocal: `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-01`, windowIds: ids };
  });
}
function anchors(chart: ChartData, rulerKeys: string[]): { key: NatalTarget; longitude: number; house: number | null }[] {
  const out: { key: NatalTarget; longitude: number; house: number | null }[] = [{ key: 'mc', longitude: chart.midheaven.longitude, house: 10 }];
  for (const key of rulerKeys) {
    const p = chart.planets.find(x => x.key === key);
    if (p && !out.some(x => x.key === key)) out.push({ key: key as NatalTarget, longitude: p.longitude, house: p.house });
  }
  return out;
}

export async function buildVocationCareerWindowPack(birth: BirthInput, generatedLocalDate: string, rulerKeys: string[]): Promise<VocationCareerWindowPack> {
  validateKnownTimeBirth({ date: birth.date, time: birth.time, unknownTime: birth.unknownTime });
  const resolved = birth.timezone && Number.isFinite(birth.latitude) && Number.isFinite(birth.longitude)
    ? { timezone: birth.timezone, lat: birth.latitude, lon: birth.longitude }
    : await geocodeLocation(birth.location);
  if (!resolved) throw new Error('vocation requires saved timezone and coordinates');
  const effectiveBirth = { ...birth, timezone: resolved.timezone, latitude: resolved.lat, longitude: resolved.lon };
  const chart = await computeChart({ ...effectiveBirth, requireAllBodies: true });
  const period = buildRollingUtcPeriodMonths(generatedLocalDate, resolved.timezone, 24);
  const natal = anchors(chart, [...rulerKeys, 'saturn', 'jupiter']);
  const scan = await scanTransitWindows({ fromUtc: period.fromUtc, toUtc: period.toUtc, evaluator: createSwissTransitEvaluator(), natal, movingBodies: [...MOVERS], natalTargets: natal.map(n => n.key) });
  const windows = scan.map((w, i) => {
    const id = `vocation.window.${w.canonicalTransitId}.${w.passIndex ?? 1}`;
    const localStart = localDate(w.activeWindow.startUtc, resolved.timezone); const localEnd = localDate(w.activeWindow.endUtc, resolved.timezone);
    const evidenceIds = [`vocation.window.${i}.fact`];
    return { id, mover: w.mover, target: w.target, aspect: w.aspectType, passIndex: w.passIndex ?? 1, activeWindow: w.activeWindow, exactHits: w.exactHits, segments: w.segments, retrograde: w.retrograde, direction: w.segments[0]?.direction ?? 'indeterminate', score: Number((100 - w.minimumActiveError * 5).toFixed(3)), evidenceIds, localStart, localEnd };
  });
  const facts: Record<string, VerifiedFact> = {};
  windows.forEach((w, i) => {
    const targetFactId = w.target === 'mc' ? 'natal.midheaven.position' : `natal.${w.target}.position`;
    facts[w.evidenceIds[0]] = { id: w.evidenceIds[0], kind: 'transit', source: 'derived-deterministic', display: `${w.mover} ${w.aspect} ${w.target}: ${w.localStart}–${w.localEnd}`, value: w, provenance: [targetFactId] };
  });
  const months = monthBuckets(generatedLocalDate, resolved.timezone, windows);
  const base = { schemaVersion: VOCATION_CAREER_WINDOW_VERSION as typeof VOCATION_CAREER_WINDOW_VERSION, generatedLocalDate, displayTimezone: resolved.timezone, period, movers: [...MOVERS], targets: natal.map(n => n.key), orbPolicy: { conjunction: 8, opposition: 8, square: 6, trine: 6, sextile: 5 }, months, windows, facts };
  return { ...base, canonicalWindowHash: crypto.createHash('sha256').update(stable(base)).digest('hex') };
}
