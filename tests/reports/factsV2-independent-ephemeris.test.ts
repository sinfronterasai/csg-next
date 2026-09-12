// F10-1 / F10-2 / F10-3 / F9-2: TRACEABLE EXTERNAL REFERENCE CORPUS tests.
//
// Every fixed constant is PARSED from a committed raw artifact, linked to its exact query,
// and verified for signature/version, target, center, quantity/frame, window, row count,
// selected timestamp, and selected value. ASC/MC/node signs are derived deterministically
// from the external longitude. CosmyDay SHA-256 is recomputed from exact committed bytes.

import { computeVerifiedCommon, mechanicalJplTimestamps, enforceJplSequenceAuthority } from '@/lib/reportFacts/derived';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { KNOWN_TIME_ORDINARY } from './fixtures/factsFixtures';
import {
  REFERENCE_INSTANT, SOURCE_METADATA, FIXED_EXPECTED, TOLERANCES, QUERY_LOG, EXTERNAL_CHART_REQUEST,
  JPL_MANIFEST, JPL_LON_DP, deriveStepMinutes,
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
const JPL_ROW_PATTERN = /\d{4}-[A-Z][a-z]{2}-\d{2} \d{2}:\d{2},/;
function jplRows(result: string): string[] {
  return result.split('\n').filter((line) => JPL_ROW_PATTERN.test(line));
}
function jplTimestamp(line: string): string {
  const match = /(\d{4}-[A-Z][a-z]{2}-\d{2} \d{2}:\d{2}),/.exec(line);
  if (!match) throw new Error(`unparseable JPL timestamp row: ${line}`);
  return match[1];
}
function jplTimestamps(result: string): string[] {
  return jplRows(result).map(jplTimestamp);
}
function expectJplTimestampSequence(result: string, row: JplManifestRow): void {
  // F13-4: the expected ordered sequence is MECHANICALLY generated from start/stop/step; the
  // hand-written row.timestamps list is no longer trusted as a second source of truth.
  const expected = mechanicalJplTimestamps(row.start, row.stop, row.step);
  const timestamps = jplTimestamps(result);
  expect(timestamps).toEqual(expected);
  expect(new Set(timestamps).size).toBe(timestamps.length);
  expect(timestamps.filter((timestamp) => timestamp === row.timeToken)).toHaveLength(1);
  // Full authority: the raw unsorted sequence equals the mechanical expectation exactly.
  const fail = enforceJplSequenceAuthority(result, row);
  expect(fail).toBeNull();
}
// F12-6: selected timestamps are exact and unique, never first-substring-match wins.
function jplRowFromResult(result: string, file: string, timeToken: string): string {
  const matches = jplRows(result).filter((line) => jplTimestamp(line) === timeToken);
  if (matches.length !== 1) throw new Error(`expected exactly one row matching ${timeToken} in ${file}, found ${matches.length}`);
  return matches[0];
}
function jplRow(file: string, timeToken: string): string {
  return jplRowFromResult(readJpl(file).result, file, timeToken);
}
// Quantity 31 row format: "YYYY-Mon-DD HH:MM, , , ObsEcLon, ObsEcLat,". The longitude is the
// 2nd non-empty field. F11-4: parse the raw ObsEcLon of the SELECTED row — it is the only
// authority for any fixed longitude constant.
function jplLonFromRow(row: string, file: string, timeToken: string): number {
  const parts = row.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
  const lon = parseFloat(parts[1]);
  if (!Number.isFinite(lon)) throw new Error(`unparseable ObsEcLon in ${file} row ${timeToken}`);
  return lon;
}
function jplLon(file: string, timeToken: string): number {
  return jplLonFromRow(jplRow(file, timeToken), file, timeToken);
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
function verifyJplArtifact(row: JplManifestRow, d: any = readJpl(row.file)): number {
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
  // F12-6: exact row count, complete raw order, unique timestamps, selected-row uniqueness,
  // and raw step all bind to this same manifest row.
  const rows = jplRows(d.result);
  expect(rows.length).toBe(row.expRows);
  expectJplTimestampSequence(d.result, row);
  expect(jplHeader(d.result, 'Step-size')).toBe(`${deriveStepMinutes(row.step)} minutes`);
  const sel = jplRowFromResult(d.result, row.file, row.timeToken);
  const lon = jplLonFromRow(sel, row.file, row.timeToken);
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
  expect(params.STEP_SIZE).toBe(`'${row.step}'`);
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

  test('every JPL manifest row locks the complete ordered timestamp sequence (mechanical authority)', () => {
    for (const row of JPL_MANIFEST) {
      const raw = readJpl(row.file);
      expectJplTimestampSequence(raw.result, row);
      const params = decodeQueryParams(QUERY_LOG[row.queryKey]);
      expect(params.STEP_SIZE).toBe(`'${row.step}'`);
    }
  });

  // F14-3 / F15-1: mechanical window contract fails closed on malformed/inconsistent inputs.
  // F15-1 requires NUMERIC calendar/time validation: regex-valid impossible values must be
  // REJECTED, never silently normalized by Date.UTC. The full permanent probe set:
  // impossible dates, leap controls, reverse window, non-divisible step, unparseable, and a
  // valid divisible window.
  test('mechanical JPL window rejects impossible/reverse/malformed windows and accepts valid ones', () => {
    // --- F15-1: impossible calendar/time values (regex-valid but invalid) ---
    // non-leap Feb 29
    expect(() => mechanicalJplTimestamps('2025-02-29 09:00', '2025-02-29 10:00', '1 h')).toThrow();
    // Feb 30
    expect(() => mechanicalJplTimestamps('2025-02-30 09:00', '2025-02-30 10:00', '1 h')).toThrow();
    // month 00 and month 13
    expect(() => mechanicalJplTimestamps('1990-00-15 09:00', '1990-00-15 10:00', '1 h')).toThrow();
    expect(() => mechanicalJplTimestamps('1990-13-15 09:00', '1990-13-15 10:00', '1 h')).toThrow();
    // day 00 and a day that overflows the month
    expect(() => mechanicalJplTimestamps('1990-06-00 09:00', '1990-06-00 10:00', '1 h')).toThrow();
    expect(() => mechanicalJplTimestamps('1990-06-31 09:00', '1990-06-31 10:00', '1 h')).toThrow();
    // hour 24 and hour 25
    expect(() => mechanicalJplTimestamps('1990-06-15 24:00', '1990-06-15 25:00', '1 h')).toThrow();
    expect(() => mechanicalJplTimestamps('1990-06-15 25:00', '1990-06-15 26:00', '1 h')).toThrow();
    // minute 60
    expect(() => mechanicalJplTimestamps('1990-06-15 09:60', '1990-06-15 10:60', '1 h')).toThrow();
    // --- F15-1: valid leap-day control (2024 is a leap year) is accepted ---
    expect(mechanicalJplTimestamps('2024-02-29 09:00', '2024-02-29 10:00', '1 h')).toEqual([
      '2024-Feb-29 09:00', '2024-Feb-29 10:00',
    ]);
    // --- F14-3 / F15-3: reverse window (start > stop) rejected; inclusive singleton accepted ---
    expect(() => mechanicalJplTimestamps('1990-06-15 11:00', '1990-06-15 09:00', '1 h')).toThrow();
    // F15-3: same-instant window is the valid inclusive one-element sequence [start]
    expect(mechanicalJplTimestamps('1990-06-15 09:00', '1990-06-15 09:00', '1 h')).toEqual(['1990-Jun-15 09:00']);
    // --- F14-3: unparseable / non-divisible windows rejected ---
    expect(() => mechanicalJplTimestamps('not-a-date', '1990-06-15 10:00', '1 h')).toThrow();
    expect(() => mechanicalJplTimestamps('1990-06-15 09:00', '1990-06-15 10:30', '1 h')).toThrow();
    // valid divisible window still produces exact increments
    expect(mechanicalJplTimestamps('1990-06-15 09:00', '1990-06-15 11:00', '1 h')).toEqual([
      '1990-Jun-15 09:00', '1990-Jun-15 10:00', '1990-Jun-15 11:00',
    ]);
  });

  // F14-3: the manifest carries NO hand-written timestamps field; only start/stop/step author it.
  test('JPL manifest rows carry no duplicate timestamps field (only start/stop/step)', () => {
    expect(JPL_MANIFEST.length).toBe(14);
    for (const row of JPL_MANIFEST) {
      expect((row as any).timestamps).toBeUndefined();
    }
  });

  test('duplicate selected timestamp replacing an expected row fails the sequence contract', () => {
    const row = JPL_MANIFEST.find((candidate) => candidate.file === 'sun_paris_1990-06-15T10.json')!;
    expect(mechanicalJplTimestamps(row.start, row.stop, row.step)).toEqual([
      '1990-Jun-15 09:00',
      '1990-Jun-15 10:00',
      '1990-Jun-15 11:00',
    ]);
    const raw = readJpl(row.file);
    const lines: string[] = raw.result.split('\n');
    const selected = lines.find((line) => line.includes(`${row.timeToken},`));
    const replaceIndex = lines.findIndex((line) => line.includes('1990-Jun-15 11:00,'));
    if (!selected || replaceIndex < 0) throw new Error('Sun duplicate-timestamp mutation setup failed');
    lines[replaceIndex] = selected;
    const mutated = lines.join('\n');
    expect(jplRows(mutated)).toHaveLength(row.expRows);
    expect(() => verifyJplArtifact(row, { ...raw, result: mutated })).toThrow();
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
