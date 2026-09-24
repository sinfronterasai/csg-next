import { buildRollingUtcPeriodMonths } from '@/lib/yearlyTransit/period';

export interface VocationBirthDataLike {
  dob?: string;
  date?: string;
  birthTime?: string | null;
  time?: string | null;
  place?: string;
  location?: string;
  tz?: string;
  timezone?: string;
  lat?: number;
  latitude?: number;
  lon?: number;
  longitude?: number;
}

export interface VocationIntegrityResult { ok: boolean; errors: string[] }

function sameNumber(a: unknown, b: unknown): boolean {
  return typeof a === 'number' && typeof b === 'number' && Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 1e-6;
}

function normalizeBirth(value: VocationBirthDataLike) {
  return {
    date: String(value.dob ?? value.date ?? ''),
    time: String(value.birthTime ?? value.time ?? ''),
    location: String(value.place ?? value.location ?? '').trim(),
    timezone: String(value.tz ?? value.timezone ?? ''),
    latitude: value.lat ?? value.latitude,
    longitude: value.lon ?? value.longitude,
  };
}

export function validateVocationSnapshot(birthData: VocationBirthDataLike, ledger: any): VocationIntegrityResult {
  const errors: string[] = [];
  const pack = ledger?.reportData?.vocationEvidence?.careerWindowPack ?? ledger?.reportData?.vocationCareerWindows;
  const snapshot = pack?.birthSnapshot;
  if (!snapshot || !pack) return { ok: false, errors: ['missing vocation birth snapshot or career-window pack'] };
  const actual = normalizeBirth(birthData);
  if (actual.date !== snapshot.date) errors.push('birth date does not match deterministic snapshot');
  if (actual.time !== snapshot.time) errors.push('birth time does not match deterministic snapshot');
  if (actual.location && actual.location !== snapshot.location) errors.push('birth location does not match deterministic snapshot');
  if (actual.timezone && actual.timezone !== snapshot.timezone) errors.push('saved IANA timezone does not match deterministic snapshot');
  if (actual.latitude !== undefined && !sameNumber(actual.latitude, snapshot.latitude)) errors.push('birth latitude does not match deterministic snapshot');
  if (actual.longitude !== undefined && !sameNumber(actual.longitude, snapshot.longitude)) errors.push('birth longitude does not match deterministic snapshot');
  if (pack.displayTimezone !== snapshot.timezone) errors.push('career pack display timezone does not match birth snapshot');
  if (pack.months?.length !== 24) errors.push('career pack must contain exactly 24 months');
  if (pack.generatedLocalDate && pack.period) {
    try {
      const expected = buildRollingUtcPeriodMonths(pack.generatedLocalDate, snapshot.timezone, 24);
      if (expected.fromUtc !== pack.period.fromUtc || expected.toUtc !== pack.period.toUtc) errors.push('career pack UTC period does not match its local start and timezone');
    } catch { errors.push('career pack has an invalid local start or timezone'); }
  }
  const from = Date.parse(pack.period?.fromUtc ?? '');
  const to = Date.parse(pack.period?.toUtc ?? '');
  for (const window of pack.windows ?? []) {
    const start = Date.parse(window.activeWindow?.startUtc ?? '');
    const end = Date.parse(window.activeWindow?.endUtc ?? '');
    if (!(start >= from && end <= to && start < end)) errors.push(`career window ${window.id} lies outside the exclusive report period`);
    for (const hit of window.exactHits ?? []) {
      const instant = Date.parse(hit.exactUtc);
      if (!(instant >= from && instant < to)) errors.push(`exact hit for ${window.id} lies outside the report period`);
    }
  }
  return { ok: errors.length === 0, errors };
}

export function sanitizeVocationProse(value: string): string {
  return value
    .replace(/\(?\b(?:common|natal|score|vocation)\.[A-Za-z0-9_.-]+(?:\s*&\s*\.\d+)?\)?/g, '')
    .replace(/\s*&\s*\.\d+/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\(\s*\)/g, '')
    .trim();
}

export function hasUnsafeVocationProse(sections: Array<{ prose?: string; blocks?: Array<{ prose?: string }> }>): string[] {
  const errors: string[] = [];
  const internal = /(?:common\.|natal\.|vocation\.window\.|score\.[a-z]+\.|window-pack hash|[12]\d{3}-\d\d-\d\dT\d\d:)/i;
  const certainty = /\b(?:you will|you are going to|guaranteed to|guarantee(?:d)? employment|guarantee(?:d)? income|guarantee(?:d)? wealth)\b/i;
  for (const section of sections) {
    const prose = [section.prose, ...(section.blocks ?? []).map((b) => b.prose)].filter(Boolean).join('\n');
    if (internal.test(prose)) errors.push('customer prose contains internal evidence identifiers, hashes, or raw timestamps');
    if (certainty.test(prose)) errors.push('customer prose contains literal-event or income/wealth certainty');
  }
  return [...new Set(errors)];
}
