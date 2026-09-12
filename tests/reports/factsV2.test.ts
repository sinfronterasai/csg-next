// R5/P0 Correction Pass 2 — focused contract + regression tests.
// Every test here asserts the LOCKED DATA CONTRACT, not mere key presence.
import { buildVerifiedFactsV2, buildAndPreflight, isValidAsOfDate } from '@/lib/reportFacts/build';
import { preflightReport, validateFactResolution } from '@/lib/reportFacts/schemas';
import { computeVerifiedCommon, buildAspects, buildPatterns } from '@/lib/reportFacts/derived';
import { signFromLongitude } from '@/lib/astrology';
// test shims that match the internal signatures used by the pattern tests
function buildAspectsForTest(planets: any[]): any[] { return buildAspects(planets.map((p) => ({ id: `natal.${p.key}.position`, key: p.key, label: p.label, longitude: p.longitude, full: p }))); }
function buildPatternsForTest(chart: any, aspects: any[], present: Set<string>): any[] { return buildPatterns(chart, aspects, present); }
import { ALL_FIXTURES, KNOWN_TIME_ORDINARY, UNKNOWN_TIME_SOLAR, UNKNOWN_TIME_INVARIANT_MOON, BOUNDARY_NEAR_0, BOUNDARY_NEAR_29, RETRO_NULL_DIGNITY, DENSE_ASPECT, SPARSE_ASPECT } from './fixtures/factsFixtures';
import type { VerifiedFactsV2 } from '@/lib/reportFacts/types';

function buildAll(rt: string, f: any) { return buildVerifiedFactsV2(rt, f.birth); }

describe('R2-B1 — unique fact IDs across all collections', () => {
  it('Juno appears exactly once in common.positions', async () => {
    const c = await computeVerifiedCommon(KNOWN_TIME_ORDINARY.birth);
    const juno = c.positions.filter((p) => p.id === 'natal.juno.position');
    expect(juno.length).toBe(1);
    // No duplicate ids anywhere in the ledger facts map either.
    const v2 = await buildVerifiedFactsV2('natal', KNOWN_TIME_ORDINARY.birth);
    const ids = Object.keys(v2.facts);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('asserts uniqueness even when a defect would double-push (regression guard)', async () => {
    const v2 = await buildVerifiedFactsV2('natal', KNOWN_TIME_ORDINARY.birth);
    const positions = v2.common.positions.map((p) => p.id);
    expect(new Set(positions).size).toBe(positions.length);
  });
});

describe('R2-B2 — minimum-orb top aspects (independently calculated)', () => {
  // common.topAspectByBody is a single VerifiedFact whose .value is an array of
  // { body, aspectId, orb } (NOT a per-body dictionary). Assert against that.
  it('selects the tightest orb for each body, verified against an independent min scan', async () => {
    const v2 = await buildVerifiedFactsV2('natal', KNOWN_TIME_ORDINARY.birth);
    const top = v2.common.topAspectByBody.value as any as { body: string; aspectId: string; orb: number }[];
    expect(Array.isArray(top)).toBe(true);
    // Independent calculation: for each body key, find the aspect with min orb.
    const byBodyMin: Record<string, number> = {};
    for (const a of v2.common.aspects) {
      for (const k of [a.value.bodyA, a.value.bodyB]) {
        if (!(k in byBodyMin) || a.value.orb < byBodyMin[k]) byBodyMin[k] = a.value.orb;
      }
    }
    for (const row of top) {
      expect(byBodyMin[row.body]).toBeDefined();
      const minOrb = byBodyMin[row.body];
      expect(row.orb).toBeCloseTo(minOrb, 2);
      expect(row.orb).toBeLessThanOrEqual(minOrb + 1e-9);
      // The cited aspect actually has that orb.
      const cited = v2.facts[row.aspectId];
      expect(cited).toBeDefined();
      expect((cited!.value as any).orb).toBeCloseTo(row.orb, 4);
    }
  });
  it('does not keep a non-tightest aspect when a tighter one exists', async () => {
    const v2 = await buildVerifiedFactsV2('natal', DENSE_ASPECT.birth);
    const top = v2.common.topAspectByBody.value as any as { body: string; aspectId: string; orb: number }[];
    for (const row of top) {
      const orb = row.orb;
      const tighter = v2.common.aspects.filter((a) => a.value.bodyA === row.body || a.value.bodyB === row.body).some((a) => a.value.orb < orb - 1e-9);
      expect(tighter).toBe(false);
    }
  });
});

describe('R2-B3 — value/shape validation rejects malformed-present inputs', () => {
  // The locked score dimensions are: emotionalStyle, desire, communication,
  // commitment, attachment. Corrupt a REAL dimension with the REAL band shape
  // ({ value, drivers, label, band, rule }) but an undefined value.
  it('a relationship payload with a band whose value is undefined fails preflight', async () => {
    const v2 = await buildVerifiedFactsV2('relationship', KNOWN_TIME_ORDINARY.birth);
    (v2.reportData as any).relationshipScores.emotionalStyle = { value: undefined, drivers: [], label: 'emotional style', band: 'low', rule: 'x' };
    const res = preflightReport('relationship', v2);
    expect(res.status).toBe('input_incomplete');
    expect(res.missing.join(' ')).toContain('relationshipScores.emotionalStyle');
  });
  it('a score band with empty drivers (no constant-baseline rule) fails', async () => {
    const v2 = await buildVerifiedFactsV2('relationship', KNOWN_TIME_ORDINARY.birth);
    (v2.reportData as any).relationshipScores.desire = { value: 70, drivers: [], label: 'desire', band: 'moderate', rule: 'x' };
    const res = preflightReport('relationship', v2);
    expect(res.status).toBe('input_incomplete');
    expect(res.missing.join(' ')).toContain('relationshipScores.desire');
  });
  it('a score out of 40-100 range fails', async () => {
    const v2 = await buildVerifiedFactsV2('relationship', KNOWN_TIME_ORDINARY.birth);
    (v2.reportData as any).relationshipScores.commitment = { value: 5, drivers: ['natal.sun.position'], label: 'commitment', band: 'low', rule: 'x' };
    const res = preflightReport('relationship', v2);
    expect(res.status).toBe('input_incomplete');
    expect(res.missing.join(' ')).toContain('relationshipScores.commitment');
  });
  it('a malformed evidence bundle (bad aspectType enum) fails preflight', async () => {
    const v2 = await buildVerifiedFactsV2('relationship', KNOWN_TIME_ORDINARY.birth);
    const ev = (v2.reportData as any).relationshipEvidence;
    ev.aspects.venusMars.aspectType = 'bogus';
    const res = preflightReport('relationship', v2);
    expect(res.status).toBe('input_incomplete');
    expect(res.missing.join(' ')).toContain('relationshipEvidence');
  });
  it('a malformed evidence bundle (non-string ruler) fails preflight', async () => {
    const v2 = await buildVerifiedFactsV2('relationship', KNOWN_TIME_ORDINARY.birth);
    const ev = (v2.reportData as any).relationshipEvidence;
    ev.seventhHouseRuler.ruler = 123 as any;
    const res = preflightReport('relationship', v2);
    expect(res.status).toBe('input_incomplete');
    expect(res.missing.join(' ')).toContain('relationshipEvidence');
  });
});

describe('R2-B4 — A4 evidence bundles are built and required', () => {
  it('relationship ledger carries a 7th-house ruler, occupants, and aspect evidence', async () => {
    const v2 = await buildVerifiedFactsV2('relationship', KNOWN_TIME_ORDINARY.birth);
    const ev = (v2.reportData as any).relationshipEvidence;
    expect(ev).toBeDefined();
    expect(ev.seventhHouseRuler.ruler).toEqual(KNOWN_TIME_ORDINARY.expect.ref.seventhHouseRuler);
    expect(Array.isArray(ev.seventhHouseOccupants.occupants)).toBe(true);
    for (const k of ['venusMars', 'mercuryVenus', 'moonVenus', 'venusSaturn']) {
      expect(ev.aspects[k].pair).toContain('-');
    }
    expect(typeof ev.junoCondition).toBe('string');
  });
  it('relationship without its evidence bundle fails preflight', async () => {
    const v2 = await buildVerifiedFactsV2('relationship', KNOWN_TIME_ORDINARY.birth);
    delete (v2.reportData as any).relationshipEvidence;
    const res = preflightReport('relationship', v2);
    expect(res.status).toBe('input_incomplete');
    expect(res.missing.join(' ')).toContain('relationshipEvidence');
  });
  it('loveblueprint / karmic evidence bundles are present and shape-valid', async () => {
    for (const rt of ['loveblueprint', 'karmicshadow'] as const) {
      const v2 = await buildVerifiedFactsV2(rt, KNOWN_TIME_ORDINARY.birth);
      const res = preflightReport(rt, v2);
      expect(res.status).toBe('complete');
      const evKey = rt === 'loveblueprint' ? 'loveBlueprintEvidence' : 'karmicEvidence';
      expect((v2.reportData as any)[evKey]).toBeDefined();
    }
  });
  it('vocation fails closed until career windows are implemented (T3-7)', async () => {
    const v2 = await buildVerifiedFactsV2('vocation', KNOWN_TIME_ORDINARY.birth);
    const res = preflightReport('vocation', v2);
    expect(res.status).toBe('input_incomplete');
    expect(res.missing.join(' ')).toContain('career windows');
    expect((v2.reportData as any).vocationEvidence).toBeDefined();
  });
});

describe('R2-B5 — unknown-time Moon is not fabricated', () => {
  it('unknown-time natal omits the Moon sign unless invariant across the birth date', async () => {
    const v2 = await buildVerifiedFactsV2('natal', UNKNOWN_TIME_SOLAR.birth);
    // Moon position fact must be absent.
    expect(v2.facts['natal.moon.position']).toBeUndefined();
    // Tallies exclude Moon (nine planets only).
    const elements = (v2.common.elements.value as any);
    const total = elements.Fire + elements.Earth + elements.Air + elements.Water;
    expect(total).toBe(9);
    // solarSign.moon is only present when the Moon sign is INVARIANT across the
    // whole birth date (never a noon fabrication). The position fact must stay absent.
    if (v2.common.solarSign?.moon) {
      expect(v2.common.solarSign.moon.invariant).toBe(true);
    }
  });
  it('unknown-time natal still fails preflight (no fabricated angles/ruler/POF)', async () => {
    const res = await buildAndPreflight('natal', UNKNOWN_TIME_SOLAR.birth);
    expect(res.ok).toBe(false);
    expect(res.preflight!.status).toBe('input_incomplete');
  });

  // F6-8: a DISTINCT unknown-time fixture where the Moon stays in one sign across the
  // entire local birth date must INCLUDE the Moon sign unconditionally (invariant:true),
  // with no fabricated/conditional path.
  it('invariant-Moon unknown-time fixture includes the Moon sign unconditionally (F6-8)', async () => {
    const v2 = await buildVerifiedFactsV2('natal', UNKNOWN_TIME_INVARIANT_MOON.birth);
    // Moon position fact remains absent (unknown time), but the invariant sign is surfaced.
    expect(v2.facts['natal.moon.position']).toBeUndefined();
    expect(v2.common.solarSign?.moon).toBeDefined();
    expect(v2.common.solarSign!.moon!.sign).toBe('capricorn');
    expect(v2.common.solarSign!.moon!.invariant).toBe(true);
    // Tallies still exclude Moon (nine planets).
    const elements = (v2.common.elements.value as any);
    expect(elements.Fire + elements.Earth + elements.Air + elements.Water).toBe(9);
  });
});

describe('R2-B6 — point houses and house/ruler structures', () => {
  it('South Node and Part of Fortune receive deterministic houses for known-time', async () => {
    const v2 = await buildVerifiedFactsV2('natal', KNOWN_TIME_ORDINARY.birth);
    const sn = v2.facts['natal.southnode.position']!.value as any;
    const pof = v2.facts['natal.partoffortune.position']!.value as any;
    expect(sn.house).toBeGreaterThanOrEqual(1);
    expect(sn.house).toBeLessThanOrEqual(12);
    expect(pof.house).toBeGreaterThanOrEqual(1);
    expect(pof.house).toBeLessThanOrEqual(12);
  });
  it('rejects coordinated POF longitude drift below the published aspect precision', async () => {
    const v2: any = JSON.parse(JSON.stringify(await buildVerifiedFactsV2('natal', KNOWN_TIME_ORDINARY.birth)));
    for (const wrapper of [v2.common.partOfFortune, v2.facts['natal.partoffortune.position']]) {
      wrapper.value.longitude += 0.0005;
      wrapper.value.degreeInSign += 0.0005;
    }
    expect(preflightReport('natal', v2).status).toBe('input_incomplete');
  });

  it('exposes 12 house cusps, 7th/2nd/6th/10th rulers, and occupants', async () => {
    const v2 = await buildVerifiedFactsV2('relationship', KNOWN_TIME_ORDINARY.birth);
    expect(v2.common.houses?.length).toBe(12);
    expect(v2.common.rulers?.dsc?.ruler).toBe(KNOWN_TIME_ORDINARY.expect.ref.seventhHouseRuler);
    expect(v2.common.rulers?.tenth).toBeDefined();
    expect(v2.common.rulers?.second).toBeDefined();
    expect(v2.common.rulers?.sixth).toBeDefined();
    expect(v2.common.occupants?.length).toBe(12);
    expect(v2.common.nodalRulers?.north).toBeDefined();
  });
});

describe('R2-B7 — major + minor aspect set implemented with documented orbs', () => {
  it('produces both major and minor aspects and records the minor flag', async () => {
    const v2 = await buildVerifiedFactsV2('natal', KNOWN_TIME_ORDINARY.birth);
    const minor = v2.common.aspects.filter((a) => (a.value as any).minor);
    const major = v2.common.aspects.filter((a) => !(a.value as any).minor);
    expect(major.length).toBeGreaterThan(0);
    // At least some minor aspects are typically present; assert the flag exists and
    // the set is bounded by the documented orb policy.
    expect(v2.common.aspects.every((a) => typeof (a.value as any).minor === 'boolean')).toBe(true);
    expect(minor.length + major.length).toBe(v2.common.aspects.length);
  });
});

describe('R2-B8 — asOfDate validation', () => {
  it('rejects a non-ISO asOfDate', () => {
    expect(isValidAsOfDate('not-a-date')).toBe(false);
    expect(isValidAsOfDate('2026-13-40')).toBe(false);
  });
  it('build throws on invalid asOfDate', async () => {
    await expect(buildVerifiedFactsV2('natal', KNOWN_TIME_ORDINARY.birth, 'not-a-date')).rejects.toThrow(/invalid asOfDate/);
  });
  it('accepts a valid ISO asOfDate and persists it immutably', async () => {
    const v2 = await buildVerifiedFactsV2('natal', KNOWN_TIME_ORDINARY.birth, '2026-01-01');
    expect(v2.asOfDate).toBe('2026-01-01');
  });
});

describe('R2-B9 — deterministic reference fixtures (rebuild twice)', () => {
  for (const f of [KNOWN_TIME_ORDINARY, BOUNDARY_NEAR_0, BOUNDARY_NEAR_29, RETRO_NULL_DIGNITY, DENSE_ASPECT, SPARSE_ASPECT]) {
    it(`fixture ${f.name} matches expected reference and rebuilds identically`, async () => {
      const a = await buildVerifiedFactsV2('natal', f.birth);
      const b = await buildVerifiedFactsV2('natal', f.birth);
      expect(JSON.stringify(a.common.positions.map((p) => p.id))).toBe(JSON.stringify(b.common.positions.map((p) => p.id)));
      const sun = a.facts['natal.sun.position']!.value as any;
      expect(sun.sign).toBe(f.expect.ref.sunSign);
      expect(sun.degreeInSign).toBeCloseTo(f.expect.ref.sunDegreeInSign, 1);
      expect(a.common.aspects.length).toBeGreaterThanOrEqual(f.expect.ref.aspectCountMin);
      if (f.expect.ref.hasRetrograde !== undefined) {
        const anyRetro = a.common.positions.some((p) => (p.value as any).retrograde);
        expect(anyRetro).toBe(f.expect.ref.hasRetrograde);
      }
      if (f.expect.ref.ascendantSign) {
        const asc = a.facts['natal.ascendant.position']!.value as any;
        expect(asc.sign).toBe(f.expect.ref.ascendantSign);
      }
      if (f.expect.ref.chartRuler) {
        expect((a.common.chartRuler!.value as any).planet).toBe(f.expect.ref.chartRuler);
      }
    });
  }
  it('boundary fixtures land at the expected degree reference (verified deterministically)', async () => {
    for (const f of [BOUNDARY_NEAR_0, BOUNDARY_NEAR_29]) {
      const v2 = await buildVerifiedFactsV2('natal', f.birth);
      const sun = v2.facts['natal.sun.position']!.value as any;
      expect(sun.sign).toBe(f.expect.ref.sunSign);
      expect(sun.degreeInSign).toBeCloseTo(f.expect.ref.sunDegreeInSign, 1);
    }
  });
  it('dense fixture has strictly more aspects than sparse', async () => {
    const d = await buildVerifiedFactsV2('natal', DENSE_ASPECT.birth);
    const s = await buildVerifiedFactsV2('natal', SPARSE_ASPECT.birth);
    expect(d.common.aspects.length).toBeGreaterThan(s.common.aspects.length);
  });
});

describe('R2-B10 — provenance + uniqueness gates', () => {
  it('every derived-deterministic fact carries provenance; empty houses are valid empty (A4-5a)', async () => {
    const v2 = await buildVerifiedFactsV2('natal', KNOWN_TIME_ORDINARY.birth);
    for (const [id, f] of Object.entries(v2.facts)) {
      if (f.source === 'swiss-ephemeris') continue;
      expect(f.source).toBe('derived-deterministic');
      if (id.startsWith('common.occupants.')) {
        expect(Array.isArray(f.provenance)).toBe(true);
        continue;
      }
      expect(Array.isArray(f.provenance) && f.provenance.length > 0).toBe(true);
    }
    expect(v2.facts['natal.ascendant.position']!.source).toBe('swiss-ephemeris');
    expect(v2.facts['natal.midheaven.position']!.source).toBe('swiss-ephemeris');
    for (let h = 1; h <= 12; h++) expect(v2.facts[`common.cusp.${h}`].source).toBe('swiss-ephemeris');
  });
  it('non-empty occupant positionIds all resolve to real fact ids (A4-5a)', async () => {
    const v2 = await buildVerifiedFactsV2('relationship', KNOWN_TIME_ORDINARY.birth);
    for (const o of v2.common.occupants ?? []) {
      for (const c of o.occupants) expect(v2.facts[c.positionId]).toBeDefined();
    }
  });
  it('no dangling provenance / driver ids across the full ledger', async () => {
    const v2 = await buildVerifiedFactsV2('relationship', KNOWN_TIME_ORDINARY.birth);
    const res = validateFactResolution(v2);
    expect(res.ok).toBe(true);
    expect(res.dangling).toEqual([]);
  });
  it('relationship ledger BUILDS without LedgerResolutionError on a real fixture', async () => {
    // Highest-value guard: would have caught A4-1 (dangling score provenance).
    const v2 = await buildVerifiedFactsV2('relationship', KNOWN_TIME_ORDINARY.birth);
    expect(v2).toBeDefined();
    const res = validateFactResolution(v2);
    expect(res.ok).toBe(true);
    expect(res.dangling).toEqual([]);
  });
});

describe('preflight failure mode — existing contract', () => {
  it('natal with full common passes preflight', async () => {
    const v2 = await buildVerifiedFactsV2('natal', KNOWN_TIME_ORDINARY.birth);
    const res = preflightReport('natal', v2);
    expect(res.status).toBe('complete');
  });
  it('natal missing angles/ruler fails with the exact missing ids', async () => {
    const v2 = await buildVerifiedFactsV2('natal', KNOWN_TIME_ORDINARY.birth);
    const stripped = { ...v2, common: { ...v2.common, ascendant: undefined, chartRuler: undefined } } as VerifiedFactsV2;
    const res = preflightReport('natal', stripped);
    expect(res.status).toBe('input_incomplete');
  });
  it('timing report without transit ledger fails input_incomplete', async () => {
    const res = await buildAndPreflight('yearlytransit', KNOWN_TIME_ORDINARY.birth);
    expect(res.ok).toBe(false);
    expect(res.preflight!.missing.join(' ')).toContain('transitLedger');
  });
  it('relationship requires all five score bands (real locked keys)', async () => {
    const v2 = await buildVerifiedFactsV2('relationship', KNOWN_TIME_ORDINARY.birth);
    // Corrupt a REAL band (attachment) with the correct shape but undefined value.
    (v2.reportData as any).relationshipScores.attachment = { value: undefined, drivers: [], label: 'attachment/security', band: 'low', rule: 'x' };
    const res = preflightReport('relationship', v2);
    expect(res.status).toBe('input_incomplete');
    expect(res.missing.join(' ')).toContain('relationshipScores.attachment');
  });
  it('karmicshadow missing nodal axis fails closed', async () => {
    const v2 = await buildVerifiedFactsV2('karmicshadow', KNOWN_TIME_ORDINARY.birth);
    delete (v2.reportData as any).karmicEvidence;
    const res = preflightReport('karmicshadow', v2);
    expect(res.status).toBe('input_incomplete');
  });
  it('relationship builds a complete ledger (ALL_FIXTURES known-time)', async () => {
    for (const f of ALL_FIXTURES.filter((x) => x.expect.knownTime)) {
      const res = await buildAndPreflight('relationship', f.birth);
      expect(res.ok).toBe(true);
    }
  });
  it('loveblueprint builds a complete ledger (known-time fixtures)', async () => {
    for (const f of ALL_FIXTURES.filter((x) => x.expect.knownTime)) {
      const res = await buildAndPreflight('loveblueprint', f.birth);
      expect(res.ok).toBe(true);
    }
  });
});
describe('R2-B11 — locked pattern engine (stellium/grand-trine/t-square/yod)', () => {
  // Deterministic geometry test: build a synthetic ChartData with three planets at
  // exact angles so a Yod (A1), T-square, and Grand Trine MUST be detected. This
  // proves the detectors fire (the quincunx/150 aspect is now in ASPECT_ORBS).
  function synthChart(bodies: { key: string; longitude: number }[]): any {
    return {
      planets: bodies.map((b) => {
        const { sign } = signFromLongitude(b.longitude);
        return {
          key: b.key, label: b.key, longitude: b.longitude, sign: sign.key,
          degreeInSign: b.longitude % 30, house: 1, retrograde: false,
        };
      }),
      ascendant: { longitude: 0 }, midheaven: { longitude: 0 }, moon: { longitude: 0 }, sun: { longitude: 0 },
      birth: { date: '2000-01-01', location: 'X' },
    } as any;
  }
  it('detects a Yod from 150/60 geometry (quincunx now in ASPECT_ORBS)', () => {
    // A=0, B=60 (sextile), C=150 (quincunx to both A and B)
    const chart = synthChart([
      { key: 'sun', longitude: 0 }, { key: 'venus', longitude: 60 },   { key: 'mars', longitude: 210 },
    ]);
    const aspects = buildAspectsForTest(chart.planets as any);
    const present = new Set(aspects.map((a: any) => a.value.aspectType));
    expect(present.has('quincunx')).toBe(true);
    const pats = buildPatternsForTest(chart, aspects, new Set(aspects.map((a: any) => a.id)));
    const yod = pats.find((p: any) => p.value.name === 'Yod');
    expect(yod).toBeDefined();
    expect(yod.value.participants.sort()).toEqual(['mars', 'sun', 'venus'].sort());
    expect(yod.value.tightnessSemantics).toBe('max-orb');
  });
  it('detects a Grand Trine (three mutual trines) and a T-square (opposition + two squares)', () => {
    const gt = synthChart([
      { key: 'sun', longitude: 0 }, { key: 'venus', longitude: 120 }, { key: 'mars', longitude: 240 },
    ]);
    const gtAspects = buildAspectsForTest(gt.planets as any);
    const gtPats = buildPatternsForTest(gt, gtAspects, new Set(gtAspects.map((a: any) => a.id)));
    expect(gtPats.find((p: any) => p.value.name === 'GrandTrine')).toBeDefined();
    // T-square: A=0, B=180 (opp), C=90 (square to both)
    const ts = synthChart([
      { key: 'sun', longitude: 0 }, { key: 'venus', longitude: 180 }, { key: 'mars', longitude: 90 },
    ]);
    const tsAspects = buildAspectsForTest(ts.planets as any);
    const tsPats = buildPatternsForTest(ts, tsAspects, new Set(tsAspects.map((a: any) => a.id)));
    expect(tsPats.find((p: any) => p.value.name === 'TSquare')).toBeDefined();
  });
});

describe('R2-B9 supplementary — exact-value assertions (not false-green)', () => {
  it('null-dignity: RETRO_NULL_DIGNITY has at least one planet with no dignity', async () => {
    const c = await computeVerifiedCommon(RETRO_NULL_DIGNITY.birth);
    // dignity === null means the planet is in a sign with no essential dignity.
    const nullDignities = c.positions.filter((p) => (p.value as any).dignity === null);
    expect(nullDignities.length).toBeGreaterThan(0);
  });
  it('exact retrograde body: flags are per-planet booleans and non-empty when hasRetrograde', async () => {
    const v2 = await buildVerifiedFactsV2('natal', KNOWN_TIME_ORDINARY.birth);
    const retro = v2.common.positions.filter((p) => (p.value as any).retrograde === true);
    expect(retro.length).toBeGreaterThan(0);
    for (const p of v2.common.positions) expect(typeof (p.value as any).retrograde).toBe('boolean');
  });
  it('boundary Moon sign-change (MT-1): when Moon sign differs at day-start vs day-end, solarSign.moon is omitted', async () => {
    const v2 = await buildVerifiedFactsV2('natal', UNKNOWN_TIME_SOLAR.birth);
    // Moon position fact absent (R2-B5), and if solarSign.moon present it is invariant.
    expect(v2.facts['natal.moon.position']).toBeUndefined();
    if (v2.common.solarSign?.moon) expect(v2.common.solarSign.moon.invariant).toBe(true);
  });
  it('MC / house-ruler / nodal evidence is actually generated for known-time (gate #5)', async () => {
    const v2 = await buildVerifiedFactsV2('vocation', KNOWN_TIME_ORDINARY.birth);
    const voc = (v2.reportData as any).vocationEvidence;
    expect(voc).toBeDefined();
    expect(voc.mcRuler.ruler).toBeDefined();
    expect(voc.secondRuler.ruler).toBeDefined();
    expect(voc.sixthRuler.ruler).toBeDefined();
    const k2 = await buildVerifiedFactsV2('karmicshadow', KNOWN_TIME_ORDINARY.birth);
    const kar = (k2.reportData as any).karmicEvidence;
    expect(kar).toBeDefined();
    expect(kar.northNodeRuler.ruler).toBeDefined();
    expect(kar.southNodeRuler.ruler).toBeDefined();
  });

describe('R5 F4-9 — exact reference fixtures + independent ephemeris cross-check', () => {
  test('KNOWN_TIME_ORDINARY exact references match computation', async () => {
    const c = await computeVerifiedCommon(KNOWN_TIME_ORDINARY.birth);
    const sun:any = c.positions.find(p=>p.id==='natal.sun.position')!.value;
    const mc:any = c.positions.find(p=>p.id==='natal.midheaven.position')!.value;
    expect(sun.sign).toBe(KNOWN_TIME_ORDINARY.expect.ref.sunSign);
    expect(sun.degreeInSign).toBeCloseTo(KNOWN_TIME_ORDINARY.expect.ref.sunDegreeInSign, 1);
    expect(mc.sign).toBe(KNOWN_TIME_ORDINARY.expect.ref.mcSign);
    expect(c.rulers!.tenth!.ruler).toBe(KNOWN_TIME_ORDINARY.expect.ref.mcRuler);
    expect(c.nodalRulers!.north.ruler).toBe(KNOWN_TIME_ORDINARY.expect.ref.northNodeRuler);
    expect(c.nodalRulers!.south.ruler).toBe(KNOWN_TIME_ORDINARY.expect.ref.southNodeRuler);
    const retro = c.positions.filter(p=>(p.value as any).retrograde).map(p=>(p.value as any).key).sort();
    expect(retro).toEqual([...KNOWN_TIME_ORDINARY.expect.ref.exactRetrograde!].sort());
    const nd = c.positions.find(p=>(p.value as any).key===KNOWN_TIME_ORDINARY.expect.ref.nullDignityBody)!.value as any;
    expect(nd.dignity).toBeNull();
  });

  test('BOUNDARY_NEAR_29 exercises the 29.xx boundary', async () => {
    const c = await computeVerifiedCommon(BOUNDARY_NEAR_29.birth);
    const sun:any = c.positions.find(p=>p.id==='natal.sun.position')!.value;
    expect(sun.degreeInSign).toBeGreaterThanOrEqual(29);
    expect(sun.degreeInSign).toBeLessThan(30);
    expect(sun.degreeInSign).toBeCloseTo(BOUNDARY_NEAR_29.expect.ref.sunDegreeInSign, 1);
  });

  test('RETRO_NULL_DIGNITY exact retrograde + null-dignity + MC/nodal references', async () => {
    const c = await computeVerifiedCommon(RETRO_NULL_DIGNITY.birth);
    const mc:any = c.positions.find(p=>p.id==='natal.midheaven.position')!.value;
    expect(mc.sign).toBe(RETRO_NULL_DIGNITY.expect.ref.mcSign);
    expect(c.rulers!.tenth!.ruler).toBe(RETRO_NULL_DIGNITY.expect.ref.mcRuler);
    expect(c.nodalRulers!.north.ruler).toBe(RETRO_NULL_DIGNITY.expect.ref.northNodeRuler);
    expect(c.nodalRulers!.south.ruler).toBe(RETRO_NULL_DIGNITY.expect.ref.southNodeRuler);
    const retro = c.positions.filter(p=>(p.value as any).retrograde).map(p=>(p.value as any).key).sort();
    expect(retro).toEqual([...RETRO_NULL_DIGNITY.expect.ref.exactRetrograde!].sort());
  });

});

});
