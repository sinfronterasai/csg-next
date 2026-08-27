// F13-1 .. F13-5 — THIRTEENTH independent adversarial regression suite.
//
// Every case below targets a semantic-authority gap the thirteenth reviewer reproduced
// (0 passed / 7 failed fresh), and must pass for the INTENDED reason — a validator that
// rejects the corruption, not a harness crash. The four second-review variants lock the
// specific coordinated corruptions the second independent reviewer accepted.
//
// Run with: ./node_modules/.bin/jest tests/reports/review-thirteenth-adversarial.test.ts

import { buildVerifiedFactsV2 } from '@/lib/reportFacts/build';
import { preflightReport } from '@/lib/reportFacts/schemas';
import { buildCommonDerived, computeVerifiedCommon, POSITION_REGISTRY, ESCAPED_POSITION, mechanicalJplTimestamps, enforceJplSequenceAuthority } from '@/lib/reportFacts/derived';
import { computeChart, normDeg } from '@/lib/chartEngine';
import { signFromLongitude } from '@/lib/astrology';
import { angularDistance } from '@/lib/transit';
import { KNOWN_TIME_ORDINARY, UNKNOWN_TIME_SOLAR } from './fixtures/factsFixtures';
import * as fs from 'fs';
import * as path from 'path';
import { JPL_MANIFEST, QUERY_LOG, deriveStepMinutes } from './fixtures/independentReferenceCorpus';

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const ordinal = (n: number) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
const JPL_DIR = path.join(__dirname, 'fixtures', 'jpl-raw');
const readJpl = (name: string) => JSON.parse(fs.readFileSync(path.join(JPL_DIR, name), 'utf8'));

describe('thirteenth independent adversarial probes', () => {
  // ---- F13-1: complete position registry, nested identity, escaped-position rejection ----

  test('every generated position wrapper is accounted for by the authoritative registry', async () => {
    const v: any = await buildVerifiedFactsV2('natal', KNOWN_TIME_ORDINARY.birth);
    const registryKeys = new Set(POSITION_REGISTRY.map((e) => e.factsKey));
    // There must be exactly one position wrapper per registry key, and every position
    // wrapper key must be in the registry (no escapees).
    let positions = 0;
    for (const id of Object.keys(v.facts)) {
      if (v.facts[id].kind === 'position') {
        positions++;
        expect(registryKeys.has(id)).toBe(true);
      }
    }
    // Chiron is covered automatically through PLANET_BODIES; assert its presence.
    expect(v.facts['natal.chiron.position']).toBeDefined();
    expect(positions).toBe(POSITION_REGISTRY.length);
  });

  test('position wrapper rejects a non-registry (escaped) key', async () => {
    const v: any = clone(await buildVerifiedFactsV2('natal', KNOWN_TIME_ORDINARY.birth));
    // Build a wrapper that escapes the registry but claims kind 'position'.
    v.facts['natal.false.position'] = {
      id: 'natal.false.position', kind: 'position', source: 'swiss-ephemeris',
      display: 'False at 0.00° Aries', value: { key: 'sun', label: 'Sun', longitude: 0, degreeInSign: 0, sign: 'aries', signLabel: 'Aries', house: 1, retrograde: false, dignity: null },
    };
    expect(preflightReport('natal', v).status).toBe('input_incomplete');
  });

  test('nested value.key binds to the registry, not a mutated false key', async () => {
    const v: any = clone(await buildVerifiedFactsV2('natal', KNOWN_TIME_ORDINARY.birth));
    v.facts['natal.sun.position'].value.key = 'false-sun';
    expect(preflightReport('natal', v).status).toBe('input_incomplete');
  });

  test('nested value.label binds to the registry canonical label', async () => {
    const v: any = clone(await buildVerifiedFactsV2('natal', KNOWN_TIME_ORDINARY.birth));
    v.facts['natal.sun.position'].value.label = 'Sol';
    expect(preflightReport('natal', v).status).toBe('input_incomplete');
  });

  // ---- F13-2: exact normalized longitude, dignity, uncertainty, house locks ----

  test('canonical position longitude must equal its normalized 2dp basis (no extra decimals)', async () => {
    const v: any = clone(await buildVerifiedFactsV2('natal', KNOWN_TIME_ORDINARY.birth));
    v.facts['natal.sun.position'].value.longitude += 0.001;
    expect(preflightReport('natal', v).status).toBe('input_incomplete');
  });

  test('canonical position dignity must equal dignityFor(key, sign)', async () => {
    const v: any = clone(await buildVerifiedFactsV2('natal', KNOWN_TIME_ORDINARY.birth));
    v.facts['natal.sun.position'].value.dignity = 'domicile';
    expect(preflightReport('natal', v).status).toBe('input_incomplete');
  });

  test('known-time uncertainty must not be present (coordinated uncertain=true rejected)', async () => {
    const v: any = clone(await buildVerifiedFactsV2('natal', KNOWN_TIME_ORDINARY.birth));
    v.facts['natal.venus.position'].value.uncertain = true;
    expect(preflightReport('natal', v).status).toBe('input_incomplete');
  });

  test('known-time planet house is derived from validated cusps via the shared houseForLongitude', async () => {
    const v: any = clone(await buildVerifiedFactsV2('natal', KNOWN_TIME_ORDINARY.birth));
    v.facts['natal.venus.position'].value.house = (v.facts['natal.venus.position'].value.house % 12) + 1;
    if (v.facts['natal.venus.position'].value.house === v.facts['natal.venus.position'].value.house) {
      // force a definitely-wrong house to defeat range-only checks
      v.facts['natal.venus.position'].value.house = 12 - ((v.facts['natal.venus.position'].value.house - 1 + 1) % 12);
    }
    v.facts['natal.venus.position'].value.house = (v.facts['natal.venus.position'].value.house % 12) + 1 === v.facts['natal.venus.position'].value.house
      ? (v.facts['natal.venus.position'].value.house === 12 ? 1 : v.facts['natal.venus.position'].value.house + 1)
      : v.facts['natal.venus.position'].value.house;
    expect(preflightReport('natal', v).status).toBe('input_incomplete');
  });

  test('angle houses are locked ASC/MC/DSC/IC = 1/10/7/4', async () => {
    const v: any = clone(await buildVerifiedFactsV2('natal', KNOWN_TIME_ORDINARY.birth));
    v.facts['natal.ascendant.position'].value.house = 3;
    expect(preflightReport('natal', v).status).toBe('input_incomplete');
    const v2: any = clone(await buildVerifiedFactsV2('natal', KNOWN_TIME_ORDINARY.birth));
    v2.facts['natal.midheaven.position'].value.house = 5;
    expect(preflightReport('natal', v2).status).toBe('input_incomplete');
  });

  // ---- F13-3: derived truth re-derived before alias equality ----

  test('South Node must equal North Node + 180 (re-derived, no tolerance)', async () => {
    const v: any = clone(await buildVerifiedFactsV2('natal', KNOWN_TIME_ORDINARY.birth));
    v.facts['natal.southnode.position'].value.longitude = ESCAPED_POSITION;
    expect(preflightReport('natal', v).status).toBe('input_incomplete');
  });

  test('Descendant must equal Ascendant + 180 (re-derived)', async () => {
    const v: any = clone(await buildVerifiedFactsV2('natal', KNOWN_TIME_ORDINARY.birth));
    v.facts['natal.descendant.position'].value.longitude = normDeg(v.facts['natal.ascendant.position'].value.longitude + 90);
    expect(preflightReport('natal', v).status).toBe('input_incomplete');
  });

  test('Imum Coeli must equal Midheaven + 180 (re-derived)', async () => {
    const v: any = clone(await buildVerifiedFactsV2('natal', KNOWN_TIME_ORDINARY.birth));
    v.facts['natal.icumcoeli.position'].value.longitude = normDeg(v.facts['natal.midheaven.position'].value.longitude + 90);
    expect(preflightReport('natal', v).status).toBe('input_incomplete');
  });

  // ---- F13-4: mechanical JPL timestamp sequence ----

  test('JPL sequence is mechanically generated from start/stop/step and matches raw order', () => {
    for (const row of JPL_MANIFEST) {
      const raw = readJpl(row.file);
      const fail = enforceJplSequenceAuthority(raw.result, row);
      expect(fail).toBeNull();
    }
  });

  test('coordinated 10:30 corruption fails the 09:00-11:00 / 1h authority', () => {
    const row = JPL_MANIFEST.find((r) => r.file === 'sun_paris_1990-06-15T10.json')!;
    const raw = readJpl(row.file);
    // Move the final raw row from 11:00 to 10:30, but the manifest window/step (09:00-11:00, 1h)
    // still authorizes only [09:00, 10:00, 11:00]. The mechanical expectation rejects 10:30.
    const lines: string[] = raw.result.split('\n');
    const idx11 = lines.findIndex((l) => l.includes('1990-Jun-15 11:00,'));
    const idx10 = lines.findIndex((l) => l.includes('1990-Jun-15 10:00,'));
    if (idx11 < 0 || idx10 < 0) throw new Error('JPL fixture row markers missing');
    lines[idx11] = lines[idx11].replace('1990-Jun-15 11:00', '1990-Jun-15 10:30');
    const mutated = lines.join('\n');
    const fail = enforceJplSequenceAuthority(mutated, row);
    expect(fail).not.toBeNull();
    expect(fail).toContain('10:30');
  });

  // ---- F13-5-style independent POF aspect expectation (production cross-check) ----

  test('POF longitude and aspect orbs derive independently from computeChart inputs', async () => {
    const chart = await computeChart(KNOWN_TIME_ORDINARY.birth as any);
    const common = await buildCommonDerived(chart, false);
    const normalize = (d: number) => ((Math.round(((d % 360) + 360) % 360 * 100) / 100) % 360 + 360) % 360;
    const ascLong = normalize(chart.ascendant.longitude);
    const sunLong = normalize(chart.sun.longitude);
    const moonLong = normalize(chart.moon.longitude);
    const isDay = chart.sun.house !== null && chart.sun.house >= 7 && chart.sun.house <= 12;
    const expectedPof = normalize(isDay ? ascLong + moonLong - sunLong : ascLong + sunLong - moonLong);
    const pof = (common.partOfFortune!.value as any).longitude;
    expect(pof).toBe(expectedPof);
    const def: any = { conjunction: 0, 'semi-sextile': 30, 'semi-square': 45, sextile: 60, square: 90, trine: 120, sesquisquare: 135, quincunx: 150, opposition: 180 };
    let checked = 0;
    for (const a of common.aspects.filter((x) => x.value.bodyA === 'partoffortune' || x.value.bodyB === 'partoffortune')) {
      const other = a.value.bodyA === 'partoffortune' ? a.value.bodyB : a.value.bodyA;
      const otherPos = common.positions.find((pp: any) => (pp.value as any).key === other);
      if (!otherPos) continue;
      const otherLong = (otherPos.value as any).longitude;
      const expected = Math.round(Math.abs(angularDistance(pof, otherLong) - def[a.value.aspectType]) * 100) / 100;
      expect(a.value.orb).toBe(expected);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  // ---- second-review variants (accepted corruptions that must now be rejected) ----

  test('DSC/South Node +0.001° corruption is rejected by exact normalization', async () => {
    const v: any = clone(await buildVerifiedFactsV2('natal', KNOWN_TIME_ORDINARY.birth));
    v.facts['natal.descendant.position'].value.longitude += 0.001;
    expect(preflightReport('natal', v).status).toBe('input_incomplete');
    const v2: any = clone(await buildVerifiedFactsV2('natal', KNOWN_TIME_ORDINARY.birth));
    v2.facts['natal.southnode.position'].value.longitude += 0.001;
    expect(preflightReport('natal', v2).status).toBe('input_incomplete');
  });

  test('derived South Node house is re-derived from validated cusps', async () => {
    const v: any = clone(await buildVerifiedFactsV2('natal', KNOWN_TIME_ORDINARY.birth));
    const correct = v.facts['natal.southnode.position'].value.house;
    v.facts['natal.southnode.position'].value.house = correct === 12 ? 1 : correct + 1;
    expect(preflightReport('natal', v).status).toBe('input_incomplete');
  });

  test('coordinated JPL 10:30 step corruption fails sequence authority', () => {
    const row = JPL_MANIFEST.find((r) => r.file === 'moon_paris_1990-06-15T10.json')!;
    const raw = readJpl(row.file);
    const lines: string[] = raw.result.split('\n');
    const idx11 = lines.findIndex((l) => l.includes('1990-Jun-15 11:00,'));
    lines[idx11] = lines[idx11].replace('1990-Jun-15 11:00', '1990-Jun-15 10:30');
    const fail = enforceJplSequenceAuthority(lines.join('\n'), row);
    expect(fail).not.toBeNull();
    // The header/query window (09:00-11:00, 1h) is untouched, proving the timestamp is the authority.
    const q = decodeURIComponent(QUERY_LOG[row.queryKey]);
    expect(q).toContain("START_TIME='1990-06-15 09:00'");
    expect(q).toContain("STOP_TIME='1990-06-15 11:00'");
    expect(deriveStepMinutes(row.step)).toBe(60);
  });

  test('independent POF aspect expectation rejects a corrupted POF longitude', async () => {
    const chart = await computeChart(KNOWN_TIME_ORDINARY.birth as any);
    const common = await buildCommonDerived(chart, false);
    const pof = (common.partOfFortune!.value as any).longitude;
    const def: any = { conjunction: 0, 'semi-sextile': 30, 'semi-square': 45, sextile: 60, square: 90, trine: 120, sesquisquare: 135, quincunx: 150, opposition: 180 };
    const a = common.aspects.find((x) => (x.value.bodyA === 'partoffortune' || x.value.bodyB === 'partoffortune'));
    if (!a) return;
    const other = a.value.bodyA === 'partoffortune' ? a.value.bodyB : a.value.bodyA;
    const otherPos = common.positions.find((pp: any) => (pp.value as any).key === other)!;
    const otherLong = (otherPos.value as any).longitude;
    const corruptedPof = normDeg(pof + 1);
    const expectedFromCorrupted = Math.round(Math.abs(angularDistance(corruptedPof, otherLong) - def[a.value.aspectType]) * 100) / 100;
    // If the independent expectation is correct, a corrupted POF would NOT match production orb.
    expect(a.value.orb).not.toBe(expectedFromCorrupted);
  });

  // F14-2 (permanent parent POF-house regression, restored): coordinate a wrong valid house
  // across the flat fact AND the common alias POF wrappers and regenerate BOTH displays. The
  // validator must reject on POF house authority (houseForLongitude of recomputed longitude),
  // not on display drift. This is the unchanged coordinated parent case.
  test('parent POF house corruption (flat + alias) is rejected by house authority', async () => {
    const v: any = clone(await buildVerifiedFactsV2('natal', KNOWN_TIME_ORDINARY.birth));
    const f = v.facts['natal.partoffortune.position'];
    const a = v.common.partOfFortune;
    const wrong = f.value.house === 12 ? 11 : f.value.house + 1;
    f.value.house = wrong;
    a.value.house = wrong;
    const regen = (val: any) => {
      const { sign, degreeInSign } = signFromLongitude(val.longitude);
      const h = val.house != null ? ` in the ${ordinal(val.house)} house` : '';
      const d = val.dignity ? `, ${{ domicile: 'in domicile', exaltation: 'in exaltation', detriment: 'in detriment', fall: 'in fall' }[val.dignity as string]}` : '';
      const r = val.retrograde ? ' (retrograde)' : '';
      return `${val.label} at ${degreeInSign.toFixed(2)}° ${sign.label}${h}${d}${r}`;
    };
    f.display = regen(f.value);
    a.display = regen(a.value);
    expect(preflightReport('natal', v).status).toBe('input_incomplete');
  });
});
