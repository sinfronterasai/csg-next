import { makeSeed, seededScore, mulberry32 } from '@/lib/random';
import {
  computeTransitBodies, findAspects, moonPhase, dateToJulianDay, type TransitBody,
} from '@/lib/transit';
import {
  buildNatalReport, buildRelationshipMatrixReport, buildTransitReport, buildLoveBlueprintReport,
  buildLoveTimingReport, buildSynastryReport, buildCompositeReport, buildCouplesBundleReport,
  buildVocationReport, buildKarmicShadowReport, buildFullCosmicBundleReport,
  REPORT_META,
} from '@/lib/reportEngine';
import { computeChart } from '@/lib/chartEngine';

// Fixed inputs so the suite is deterministic and offline.
const JOHN = { name: 'John', date: '1990-06-15', time: '12:00', location: 'Paris, France', unknownTime: false };
const PARTNER = { date: '1992-02-20', time: '18:30', location: 'London, UK', unknownTime: false };

describe('random: seeded determinism', () => {
  it('makeSeed is stable for identical strings', () => {
    expect(makeSeed('a:b:c')).toBe(makeSeed('a:b:c'));
    expect(makeSeed('a:b:c')).not.toBe(makeSeed('a:b:d'));
  });
  it('mulberry32 is deterministic', () => {
    const a = mulberry32(makeSeed('seed')); const b = mulberry32(makeSeed('seed'));
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it('seededScore stays within bounds and is repeatable', () => {
    const x = seededScore('1990-06-15:3:career', 40, 100);
    const y = seededScore('1990-06-15:3:career', 40, 100);
    expect(x).toBe(y);
    expect(x).toBeGreaterThanOrEqual(40);
    expect(x).toBeLessThanOrEqual(100);
  });
});

describe('transit: aspect engine math', () => {
  const bodies: TransitBody[] = [
    { key: 'sun', label: 'Sun', glyph: '\u2609', longitude: 100, sign: 'cancer', signLabel: 'Cancer', signGlyph: '\u2652', degreeInSign: 10, retrograde: false },
  ];
  const natal = [{ key: 'mars', label: 'Mars', longitude: 102, house: 7 }];
  it('detects a conjunction within orb', () => {
    const aspects = findAspects(bodies, natal);
    expect(aspects.length).toBe(1);
    expect(aspects[0].aspectType).toBe('conjunction');
    expect(aspects[0].orb).toBeLessThanOrEqual(8);
  });
  it('ignores points outside orb', () => {
    const far = findAspects(bodies, [{ key: 'venus', label: 'Venus', longitude: 200, house: 2 }]);
    expect(far.length).toBe(0);
  });
  it('detects a trine (120deg) under orb', () => {
    const t = [{ key: 'jupiter', label: 'Jupiter', glyph: '\u2643', longitude: 220, sign: 'scorpio', signLabel: 'Scorpio', signGlyph: '\u264f', degreeInSign: 10, retrograde: false }];
    const n = [{ key: 'moon', label: 'Moon', longitude: 100, house: 4 }];
    const a = findAspects(t, n);
    expect(a.some((x) => x.aspectType === 'trine')).toBe(true);
  });
});

describe('transit: ephemeris forward-date computation', () => {
  it('computes transit bodies and finds an aspect to natal', async () => {
    const natal = await buildNatalReport(JOHN);
    expect(natal.type).toBe('natal');
    expect(natal.overview.length).toBeGreaterThan(0);
    const transit = await buildTransitReport({ natal: JOHN, fromDate: '2026-01-01' });
    expect(transit.sections.length).toBe(12);
    expect(transit.sections[0].body.length).toBeGreaterThan(0);
    const jd = dateToJulianDay(new Date('2026-06-15T12:00:00Z'));
    const tBodies = await computeTransitBodies(jd);
    expect(tBodies.length).toBeGreaterThan(0);
    const chart = await computeChart({ ...JOHN, name: 'John' });
    const natalPts = chart.planets.map((p) => ({ key: p.key, label: p.label, longitude: p.longitude }))
      .concat([
        { key: 'asc', label: 'Ascendant', longitude: chart.ascendant.longitude },
        { key: 'mc', label: 'Midheaven', longitude: chart.midheaven.longitude },
      ]);
    const aspects = findAspects(tBodies, natalPts);
    expect(Array.isArray(aspects)).toBe(true);
    expect(aspects.length).toBeGreaterThan(0);
  });
  it('moonPhase returns a fraction in [0,1] and a label', async () => {
    const mp = await moonPhase(dateToJulianDay(new Date('2026-08-13T12:00:00Z')));
    expect(mp.phase).toBeGreaterThanOrEqual(0);
    expect(mp.phase).toBeLessThanOrEqual(1);
    expect(typeof mp.label).toBe('string');
  });
});

describe('report engine: single-source determinism', () => {
  it('Natal report is identical across calls for the same birth data', async () => {
    const a = await buildNatalReport(JOHN);
    const b = await buildNatalReport(JOHN);
    expect(a.markdown).toEqual(b.markdown);
    expect(a.seed).toBe('1990-06-15:Paris, France:natal');
  });
  it('Transit report builds 12 monthly sections deterministically', async () => {
    const a = await buildTransitReport({ natal: JOHN, fromDate: '2026-01-01' });
    const b = await buildTransitReport({ natal: JOHN, fromDate: '2026-01-01' });
    expect(a.sections.length).toBe(12);
    expect(a.markdown).toEqual(b.markdown);
    expect(a.pricePaid).toBe(39);
  });
  it('Synastry report yields a deterministic 0-100 score and partner scope', async () => {
    const a = await buildSynastryReport({ self: JOHN, partner: PARTNER });
    const b = await buildSynastryReport({ self: JOHN, partner: PARTNER });
    expect(a.markdown).toEqual(b.markdown);
    expect(a.generatedFor).toBe('partner');
    expect(a.pricePaid).toBe(49);
  });
  it('Vocation report surfaces MC sign + Saturn placement deterministically', async () => {
    const a = await buildVocationReport({ natal: JOHN });
    const b = await buildVocationReport({ natal: JOHN });
    expect(a.markdown).toEqual(b.markdown);
    expect(a.pricePaid).toBe(39);
    expect(a.overview.some((r) => r.label === 'Vocation Archetype')).toBe(true);
  });
});

describe('report engine: new premium reports (master-index catalog)', () => {
  it('Relationship Matrix is free and cites real planet positions', async () => {
    const a = await buildRelationshipMatrixReport({ natal: JOHN });
    const b = await buildRelationshipMatrixReport({ natal: JOHN });
    expect(a.markdown).toEqual(b.markdown);
    expect(a.pricePaid).toBe(0);
    expect(a.type).toBe('relationship');
    const venus = (await computeChart({ ...JOHN, name: 'J' })).planets.find((p) => p.key === 'venus')!;
    expect(a.sections[0].body).toContain(venus.signLabel);
  });
  it('Love Blueprint is $39 and has an aspects section', async () => {
    const a = await buildLoveBlueprintReport({ natal: JOHN });
    expect(a.pricePaid).toBe(39);
    expect(a.type).toBe('loveblueprint');
    expect(a.sections.some((s) => /aspect/i.test(s.heading))).toBe(true);
    const b = await buildLoveBlueprintReport({ natal: JOHN });
    expect(a.markdown).toEqual(b.markdown);
  });
  it('Love Timing is $29 with 12 scored months', async () => {
    const a = await buildLoveTimingReport({ natal: JOHN });
    expect(a.pricePaid).toBe(29);
    expect(a.sections.length).toBe(12);
    expect(a.overview[0].label).toBe('Peak Love Window');
    const b = await buildLoveTimingReport({ natal: JOHN });
    expect(a.markdown).toEqual(b.markdown);
  });
  it('Composite is $29 with midpoint chart and partner scope', async () => {
    const a = await buildCompositeReport({ self: JOHN, partner: PARTNER });
    const b = await buildCompositeReport({ self: JOHN, partner: PARTNER });
    expect(a.pricePaid).toBe(29);
    expect(a.generatedFor).toBe('partner');
    expect(a.overview.some((r) => r.label.includes('Composite Ascendant'))).toBe(true);
    expect(a.markdown).toEqual(b.markdown);
  });
  it('Karmic and Shadow is $19 with node axis and prompts', async () => {
    const a = await buildKarmicShadowReport({ natal: JOHN });
    expect(a.pricePaid).toBe(19);
    expect(a.overview.some((r) => r.label.includes('North Node'))).toBe(true);
    expect(a.overview.some((r) => r.label.includes('South Node'))).toBe(true);
    expect(a.sections.some((s) => /prompt/i.test(s.heading))).toBe(true);
    const b = await buildKarmicShadowReport({ natal: JOHN });
    expect(a.markdown).toEqual(b.markdown);
  });
  it('Couples bundle is $89 and assembles both with a synthesis', async () => {
    const a = await buildCouplesBundleReport({ self: JOHN, partner: PARTNER });
    expect(a.pricePaid).toBe(89);
    expect(a.type).toBe('couples');
    expect(a.sections.some((s) => /Synthesis Index/.test(s.heading))).toBe(true);
    expect(a.markdown).toContain('Synastry');
    expect(a.markdown).toContain('Composite');
  });
  it('Full Cosmic bundle is $89 and assembles solo parts with a synthesis', async () => {
    const solo = await buildFullCosmicBundleReport({ natal: JOHN });
    expect(solo.pricePaid).toBe(89);
    expect(solo.type).toBe('fullcosmic');
    expect(solo.generatedFor).toBe('self');
    expect(solo.sections.some((s) => /Full Cosmic Synthesis/.test(s.heading))).toBe(true);
    expect(solo.markdown).toContain('Natal Birth Chart Report');
    expect(solo.markdown).toContain('Yearly Transit Forecast');
    expect(solo.markdown).toContain('Vocation and Wealth Map');
    const withPartner = await buildFullCosmicBundleReport({ natal: JOHN, partner: PARTNER });
    expect(withPartner.generatedFor).toBe('partner');
    expect(withPartner.markdown).toContain('Synastry');
  });
  it('REPORT_META matches the master-index ladder', () => {
    expect(REPORT_META).toMatchObject({
      natal: { price: 0 }, relationship: { price: 0 }, transit: { price: 39 },
      loveblueprint: { price: 39 }, lovetiming: { price: 29 }, synastry: { price: 49 },
      composite: { price: 29 }, couples: { price: 89 }, vocation: { price: 39 },
      karmicshadow: { price: 19 }, fullcosmic: { price: 89 },
    });
  });
});
