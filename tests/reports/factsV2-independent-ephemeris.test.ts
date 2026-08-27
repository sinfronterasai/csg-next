// F10-1 / F10-2 / F10-3 / F9-2: TRACEABLE EXTERNAL REFERENCE CORPUS tests.
//
// Every fixed constant is PARSED from a committed raw artifact, linked to its exact query,
// and verified for signature/version, target, center, quantity/frame, window, row count,
// selected timestamp, and selected value. ASC/MC/node signs are derived deterministically
// from the external longitude. CosmyDay SHA-256 is recomputed from exact committed bytes.

import { computeVerifiedCommon } from '@/lib/reportFacts/derived';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { KNOWN_TIME_ORDINARY } from './fixtures/factsFixtures';
import {
  REFERENCE_INSTANT, SOURCE_METADATA, FIXED_EXPECTED, TOLERANCES, QUERY_LOG, EXTERNAL_CHART_REQUEST,
  JPL_MANIFEST, JPL_LON_DP,
} from './fixtures/independentReferenceCorpus';
import type { JplManifestRow } from './fixtures/independentReferenceCorpus';

const SIGNS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
function norm360(x: number): number { return ((x % 360) + 360) % 360; }
function angularDiff(a: number, b: number): number {
  const x = Math.abs(norm360(a) - norm360(b));
  return Math.min(x, 360 - x);
}
const signOf = (lon: number) => SIGNS[Math.floor(norm360(lon) / 30)];
const JPL_DIR = path.join(__dirname, 'fixtures', 'jpl-raw');
const readJpl = (name: string) => JSON.parse(fs.readFileSync(path.join(JPL_DIR, name), 'utf8'));
// Match the exact data row by its time token (e.g. '1990-Jun-15 10:00').
function jplRow(file: string, timeToken: string): string {
  const d = readJpl(file);
  const line = d.result.split('\n').find((l: string) => l.includes(timeToken) && l.includes(','));
  if (!line) throw new Error(`no row matching ${timeToken} in ${file}`);
  return line;
}
// Quantity 31 row format: "YYYY-Mon-DD HH:MM, , , ObsEcLon, ObsEcLat,". The longitude is the
// 2nd non-empty field. F11-4: parse the raw ObsEcLon of the SELECTED row — it is the only
// authority for any fixed longitude constant.
function jplLon(file: string, timeToken: string): number {
  const row = jplRow(file, timeToken);
  const parts = row.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
  const lon = parseFloat(parts[1]);
  if (!Number.isFinite(lon)) throw new Error(`unparseable ObsEcLon in ${file} row ${timeToken}`);
  return lon;
}
// F11-4: round a parsed raw longitude at an EXPLICITLY declared precision. Used to tie every
// fixed constant to its parsed raw row with no tolerance band.
function roundTo(x: number, dp: number): number {
  const f = Math.pow(10, dp);
  return Math.round(x * f) / f;
}
// F10-1: table-driven JPL manifest. The manifest is imported from the fixtures corpus and is
// the single source of truth: the same row's exact window generates QUERY_LOG and is asserted
// against the committed raw artifact header (ISO month `06` mapped to `Jun` for the header
// comparison only). There are no separate intended windows.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// '1990-06-15 09:00' -> '1990-Jun-15 09:00' (header display form of the SAME instant).
function toHeaderToken(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}:\d{2})$/.exec(iso);
  if (!m) throw new Error(`bad manifest window value: ${iso}`);
  return `${m[1]}-${MONTHS[Number(m[2]) - 1]}-${m[3]} ${m[4]}`;
}
function jplHeader(result: string, label: string): string {
  const line = result.split('\n').find((l: string) => l.startsWith(label));
  if (!line) throw new Error(`JPL header ${label} not found`);
  const v = line.slice(line.indexOf(':') + 1).trim();
  if (!v) throw new Error(`JPL header ${label} empty`);
  return v;
}
// F11-4: decode a linked query into an exact parameter map. Substring presence of a parameter
// NAME proves nothing about its VALUE, so every asserted parameter is read from this map.
function decodeQueryParams(url: string): Record<string, string> {
  const qs = url.slice(url.indexOf('?') + 1);
  const out: Record<string, string> = {};
  for (const pair of qs.split('&')) {
    const i = pair.indexOf('=');
    if (i < 0) continue;
    const k = decodeURIComponent(pair.slice(0, i).replace(/\+/g, ' '));
    const v = decodeURIComponent(pair.slice(i + 1).replace(/\+/g, ' '));
    out[k] = v;
  }
  return out;
}
// F11-4: the exact decoded quantity/frame/format parameters every artifact query must carry.
const REQUIRED_JPL_PARAMS: Record<string, string> = {
  EPHEM_TYPE: "'OBSERVER'",
  QUANTITIES: "'31'",
  ANG_FORMAT: "'DEG'",
  CSV_FORMAT: "'YES'",
  CENTER: "'500@399'",
  MAKE_EPHEM: "'YES'",
  OBJ_DATA: "'NO'",
};
// F10-1 / F11-4: verify a committed raw artifact against the manifest + its exact query. Proves
// signature/version, target body, center, requested window, row count, selected timestamp, the
// exact decoded quantity/frame/format parameters, the raw observer-ecliptic quantity columns
// and their declared degree/frame semantics, and the exact fixed longitude linkage.
function verifyJplArtifact(row: JplManifestRow): number {
  const d = readJpl(row.file);
  expect(d.signature?.source).toContain('NASA/JPL Horizons API');
  expect(d.signature?.version).toBe('1.2');
  // target + center from the raw header
  const rawTarget = jplHeader(d.result, 'Target body name');
  const rawCenter = jplHeader(d.result, 'Center body name');
  expect(rawTarget).toContain(row.target);
  expect(rawCenter).toContain(row.center);
  // requested window from the raw header — same manifest field that generated the query
  expect(jplHeader(d.result, 'Start time')).toContain(toHeaderToken(row.start));
  expect(jplHeader(d.result, 'Stop  time')).toContain(toHeaderToken(row.stop));
  // F11-4: the raw response must expose EXACTLY the requested observer-ecliptic quantity
  // columns, in CSV degree form, with the documented observer-centered ecliptic frame.
  const lines: string[] = d.result.split('\n');
  const colHeader = lines.find((l) => l.includes('Date__(UT)__HR:MN') && l.includes('ObsEcLon'));
  if (!colHeader) throw new Error(`${row.file}: no ObsEcLon column header`);
  expect(colHeader.replace(/\s+/g, ' ').trim()).toBe('Date__(UT)__HR:MN, , , ObsEcLon, ObsEcLat,');
  expect(jplHeader(d.result, 'RA format')).toBe('DEG');
  expect(jplHeader(d.result, 'Table format')).toBe('Comma Separated Values (spreadsheet)');
  const frameDoc = d.result.replace(/\s+/g, ' ');
  expect(frameDoc).toContain("'ObsEcLon, ObsEcLat,' =");
  expect(frameDoc).toContain('Observer-centered IAU76/80 ecliptic-of-date longitude and latitude');
  expect(frameDoc).toContain('Units: DEGREES');
  // exact row count
  const rows = lines.filter((l: string) => /\d{4}-[A-Z][a-z]{2}-\d{2} \d{2}:\d{2},/.test(l));
  expect(rows.length).toBe(row.expRows);
  // selected row is present
  const sel = jplRow(row.file, row.timeToken);
  expect(sel).toContain(row.timeToken);
  const lon = jplLon(row.file, row.timeToken);
  // F11-4: EVERY fixed longitude is tied to its parsed selected raw row at the manifest's
  // explicitly declared precision. No expLon === 0 bypass, no tolerance band.
  expect(row.lonDp).toBe(JPL_LON_DP);
  expect(roundTo(lon, row.lonDp)).toBe(row.expLon);
  // the linked query must encode the SAME target/center/window (no drifting constant)
  const q = QUERY_LOG[row.queryKey];
  if (!q) throw new Error(`no linked query for ${row.file}`);
  const params = decodeQueryParams(q);
  expect(row.target).toContain(`(${row.command})`);
  expect(params.COMMAND).toBe(`'${row.command}'`);
  expect(params.START_TIME).toBe(`'${row.start}'`);
  expect(params.STOP_TIME).toBe(`'${row.stop}'`);
  for (const [k, v] of Object.entries(REQUIRED_JPL_PARAMS)) {
    expect(params[k]).toBe(v);
  }
  return lon;
}

describe('F10-1 — external JPL corpus integrity (every artifact verified)', () => {
  let eng: any;
  beforeAll(async () => { eng = await computeVerifiedCommon(KNOWN_TIME_ORDINARY.birth); });
  const lon = (id: string) => eng.positions.find((p: any) => p.id === id).value.longitude;

  test('raw JPL responses committed with NASA/JPL Horizons signature', () => {
    const files = fs.readdirSync(JPL_DIR);
    expect(files.filter((f) => f.endsWith('.json')).length).toBeGreaterThanOrEqual(15);
  });

  test('QUERY_LOG entries are exact encoded JPL URLs with required params', () => {
    // F11-4: assert exact decoded parameter VALUES, not substring presence of names.
    for (const q of Object.values(QUERY_LOG)) {
      expect(q).toContain('https://ssd.jpl.nasa.gov/api/horizons.api?');
      const params = decodeQueryParams(q);
      expect(params.EPHEM_TYPE).toBe("'OBSERVER'");
      expect(params.QUANTITIES).toBe("'31'");
      expect(params.ANG_FORMAT).toBe("'DEG'");
      expect(params.CSV_FORMAT).toBe("'YES'");
      expect(params.CENTER).toBe("'500@399'");
      expect(params.MAKE_EPHEM).toBe("'YES'");
      expect(typeof params.STEP_SIZE).toBe('string');
      expect(params.STEP_SIZE.length).toBeGreaterThan(0);
    }
    expect(QUERY_LOG.moon_solar_start).not.toBe(QUERY_LOG.moon_paris_1990_06_15T10);
    expect(QUERY_LOG.moon_solar_end).not.toBe(QUERY_LOG.moon_paris_1990_06_15T10);
    expect(QUERY_LOG.moon_invariant_start).not.toBe(QUERY_LOG.moon_paris_1990_06_15T10);
    expect(QUERY_LOG.moon_invariant_end).not.toBe(QUERY_LOG.moon_paris_1990_06_15T10);
  });

  test('boundary queries encode the exact committed artifact windows', () => {
    const dec = (s: string) => decodeURIComponent(s.replace(/\+/g, ' '));
    expect(dec(QUERY_LOG.moon_solar_start)).toContain("START_TIME='1990-06-15 21:00'");
    expect(dec(QUERY_LOG.moon_solar_start)).toContain("STOP_TIME='1990-06-15 23:00'");
    expect(dec(QUERY_LOG.moon_solar_end)).toContain("START_TIME='1990-06-16 20:59'");
    expect(dec(QUERY_LOG.moon_solar_end)).toContain("STOP_TIME='1990-06-16 22:59'");
    expect(dec(QUERY_LOG.moon_invariant_start)).toContain("START_TIME='1990-06-10 21:00'");
    expect(dec(QUERY_LOG.moon_invariant_start)).toContain("STOP_TIME='1990-06-10 23:00'");
    expect(dec(QUERY_LOG.moon_invariant_end)).toContain("START_TIME='1990-06-11 20:59'");
    expect(dec(QUERY_LOG.moon_invariant_end)).toContain("STOP_TIME='1990-06-11 22:59'");
    // outer planets use the committed 24h 2-row window, not the ordinary 09:00-11:00 window
    expect(dec(QUERY_LOG.planet_599_retro)).toContain("START_TIME='1990-06-15 10:00'");
    expect(dec(QUERY_LOG.planet_599_retro)).toContain("STOP_TIME='1990-06-16 10:00'");
  });

  test('SOURCE_METADATA records ISO retrieval date + attribution', () => {
    expect(SOURCE_METADATA.retrieved).toMatch(/^\d{4}-\d{2}-\d{2}/);
    expect(SOURCE_METADATA.primary).toContain('JPL');
    expect(SOURCE_METADATA.secondary).toContain('CosmyDay');
    expect(SOURCE_METADATA.zodiac).toBe('tropical');
  });

  test('Sun artifact verified (signature/target/window/rows/value) and linked to fixed expected', () => {
    const m = JPL_MANIFEST.find((r) => r.file === 'sun_paris_1990-06-15T10.json')!;
    const jpl = verifyJplArtifact(m);
    expect(roundTo(jpl, m.lonDp)).toBe(FIXED_EXPECTED.sun.longitude);
    expect(angularDiff(lon('natal.sun.position'), jpl)).toBeLessThanOrEqual(TOLERANCES.bodyLongitude);
    expect(signOf(lon('natal.sun.position'))).toBe(FIXED_EXPECTED.sun.sign);
  });

  test('Moon artifact verified and linked to fixed expected', () => {
    const m = JPL_MANIFEST.find((r) => r.file === 'moon_paris_1990-06-15T10.json')!;
    const jpl = verifyJplArtifact(m);
    expect(roundTo(jpl, m.lonDp)).toBe(FIXED_EXPECTED.moon.longitude);
    expect(angularDiff(lon('natal.moon.position'), jpl)).toBeLessThanOrEqual(TOLERANCES.bodyLongitude);
    expect(signOf(lon('natal.moon.position'))).toBe(FIXED_EXPECTED.moon.sign);
  });

  test('every committed JPL artifact satisfies its manifest (target/center/window/rows/query)', () => {
    // F11-4: no expLon bypass and no 0.5-degree band. Every row's fixed constant equals the
    // parsed selected raw ObsEcLon rounded at the row's declared precision.
    expect(JPL_MANIFEST.length).toBe(14);
    for (const m of JPL_MANIFEST) {
      const lon = verifyJplArtifact(m);
      expect(roundTo(lon, m.lonDp)).toBe(m.expLon);
    }
  });

  test('unknown-time fixture Moon boundaries verified against their distinct artifacts', () => {
    const solar = FIXED_EXPECTED.unknownTimeSolar;
    const inv = FIXED_EXPECTED.unknownTimeInvariantMoon;
    expect(solar.moonStart.utc).toBe('1990-06-15T22:00:00Z');
    expect(solar.moonEnd.utc).toBe('1990-06-16T21:59:00Z');
    expect(inv.moonStart.utc).toBe('1990-06-10T22:00:00Z');
    expect(inv.moonEnd.utc).toBe('1990-06-11T21:59:00Z');
    const s0 = verifyJplArtifact(JPL_MANIFEST.find((r) => r.file === 'moon_solar_start.json')!);
    const s1 = verifyJplArtifact(JPL_MANIFEST.find((r) => r.file === 'moon_solar_end.json')!);
    const i0 = verifyJplArtifact(JPL_MANIFEST.find((r) => r.file === 'moon_invariant_start.json')!);
    const i1 = verifyJplArtifact(JPL_MANIFEST.find((r) => r.file === 'moon_invariant_end.json')!);
    // F11-4: boundary constants are tied to their parsed raw rows at declared precision.
    expect(roundTo(s0, JPL_LON_DP)).toBe(solar.moonStart.longitude);
    expect(roundTo(s1, JPL_LON_DP)).toBe(solar.moonEnd.longitude);
    expect(roundTo(i0, JPL_LON_DP)).toBe(inv.moonStart.longitude);
    expect(roundTo(i1, JPL_LON_DP)).toBe(inv.moonEnd.longitude);
  });
});

describe('F10-2 — external CosmyDay chart service (ASC/MC/node + retrograde)', () => {
  let eng: any;
  let cos: any;
  beforeAll(async () => {
    eng = await computeVerifiedCommon(KNOWN_TIME_ORDINARY.birth);
    cos = JSON.parse(fs.readFileSync(path.join(JPL_DIR, 'cosmyday-paris-1990-06-15T12-local.json'), 'utf8'));
  });
  const lon = (id: string) => eng.positions.find((p: any) => p.id === id).value.longitude;

  test('F10-3 — CosmyDay SHA-256 recomputed from exact committed bytes equals manifest', () => {
    const raw = fs.readFileSync(path.join(JPL_DIR, 'cosmyday-paris-1990-06-15T12-local.json'));
    // F11-4: recompute the digest ONCE and assert BOTH committed copies equal it, so neither
    // duplicate can drift silently.
    const digest = createHash('sha256').update(raw).digest('hex');
    expect(digest).toBe('977c48a3d9c918f88be2bb49b108a7a3a50fff7e9b7d1dbe22310a9abdd3077f');
    expect(EXTERNAL_CHART_REQUEST.responseSha256).toBe(digest);
    expect(SOURCE_METADATA.cosmydayResponseSha256).toBe(digest);
    expect(EXTERNAL_CHART_REQUEST.method).toBe('POST');
    expect(EXTERNAL_CHART_REQUEST.url).toBe('https://api.cosmyday.com/natal');
  });

  test('ASC external longitude + derived sign agree with production', () => {
    expect(angularDiff(lon('natal.ascendant.position'), cos.ascendant)).toBeLessThanOrEqual(TOLERANCES.bodyLongitude);
    expect(cos.ascendant).toBeCloseTo(FIXED_EXPECTED.ascendant.longitude, 3);
    expect(signOf(cos.ascendant)).toBe(FIXED_EXPECTED.ascendant.sign); // virgo
    expect(signOf(lon('natal.ascendant.position'))).toBe(FIXED_EXPECTED.ascendant.sign);
  });

  test('MC external longitude + derived sign agree with production (58.0384 = Taurus)', () => {
    expect(angularDiff(lon('natal.midheaven.position'), cos.midheaven)).toBeLessThanOrEqual(TOLERANCES.bodyLongitude);
    expect(cos.midheaven).toBeCloseTo(FIXED_EXPECTED.midheaven.longitude, 3);
    expect(signOf(cos.midheaven)).toBe(FIXED_EXPECTED.midheaven.sign); // taurus
    expect(FIXED_EXPECTED.midheaven.sign).toBe('taurus');
    expect(signOf(lon('natal.midheaven.position'))).toBe(FIXED_EXPECTED.midheaven.sign);
  });

  test('selected node (true north node) external longitude + derived sign agree with production', () => {
    expect(angularDiff(lon('natal.northnode.position'), cos.planets.NorthNode.lon)).toBeLessThanOrEqual(TOLERANCES.nodeLongitude);
    expect(cos.planets.NorthNode.lon).toBeCloseTo(FIXED_EXPECTED.northNode.longitude, 3);
    expect(signOf(cos.planets.NorthNode.lon)).toBe(FIXED_EXPECTED.northNode.sign); // aquarius
    expect(signOf(lon('natal.northnode.position'))).toBe(FIXED_EXPECTED.northNode.sign);
  });

  test('retrograde set DERIVED from CosmyDay planets[*].retrograde equals fixed expected', () => {
    const externalRetro = Object.entries(cos.planets as Record<string, any>)
      .filter(([, p]) => p.retrograde === true)
      .map(([name]) => name.toLowerCase())
      .sort();
    expect(externalRetro).toEqual([...FIXED_EXPECTED.retrograde].sort());
    const engRetro = eng.positions.filter((p: any) => p.value.retrograde).map((p: any) => p.value.key).sort();
    expect(engRetro).toEqual([...FIXED_EXPECTED.retrograde].sort());
  });
});
