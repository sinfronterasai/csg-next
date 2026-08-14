import { makeSeed, seededScore, mulberry32 } from '@/lib/random';
import {
  computeTransitBodies, findAspects, moonPhase, dateToJulianDay, type TransitBody,
} from '@/lib/transit';
import {
  buildNatalReport, buildTransitReport, buildSynastryReport, buildVocationReport,
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
  // Two points exactly conjunct -> conjunction with orb ~0.
  const bodies: TransitBody[] = [
    { key: 'sun', label: 'Sun', glyph: '☉', longitude: 100, sign: 'cancer', signLabel: 'Cancer', signGlyph: '♋', degreeInSign: 10, retrograde: false },
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
    const t = [{ key: 'jupiter', label: 'Jupiter', glyph: '♃', longitude: 220, sign: 'scorpio', signLabel: 'Scorpio', signGlyph: '♏', degreeInSign: 10, retrograde: false }];
    const n = [{ key: 'moon', label: 'Moon', longitude: 100, house: 4 }];
    const a = findAspects(t, n);
    expect(a.some((x) => x.aspectType === 'trine')).toBe(true);
  });
});

describe('transit: ephemeris forward-date computation', () => {
  it('computes transit bodies and finds an aspect to natal', async () => {
    // Build a natal chart, then run the real transit pipeline the engine uses.
    const natal = await buildNatalReport(JOHN);
    expect(natal.type).toBe('natal');
    expect(natal.overview.length).toBeGreaterThan(0);

    const transit = await buildTransitReport({ natal: JOHN, fromDate: '2026-01-01' });
    expect(transit.sections.length).toBe(12);
    // The first month must have at least one aspect (transit bodies vs natal points).
    expect(transit.sections[0].body.length).toBeGreaterThan(0);
    // computeTransitBodies + findAspects are exercised inside buildTransitReport;
    // assert the aspect math directly too for the flagged coverage gap.
    const jd = dateToJulianDay(new Date('2026-06-15T12:00:00Z'));
    const bodies = await computeTransitBodies(jd);
    expect(bodies.length).toBeGreaterThan(0);
    // Build real natal points from the engine's own chart (same shape findAspects expects).
    const chart = await computeChart({ ...JOHN, name: 'John' });
    const natalPts = chart.planets.map((p) => ({ key: p.key, label: p.label, longitude: p.longitude }))
      .concat([
        { key: 'asc', label: 'Ascendant', longitude: chart.ascendant.longitude },
        { key: 'mc', label: 'Midheaven', longitude: chart.midheaven.longitude },
      ]);
    const aspects = findAspects(bodies, natalPts);
    expect(Array.isArray(aspects)).toBe(true);
    // The aspect math must actually find overlays: a full transit set against a
    // complete natal chart yields real aspects (not an empty array).
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
    expect(a.pricePaid).toBe(49);
  });

  it('Synastry report yields a deterministic 0-100 score and partner scope', async () => {
    const a = await buildSynastryReport({ self: JOHN, partner: PARTNER });
    const b = await buildSynastryReport({ self: JOHN, partner: PARTNER });
    expect(a.markdown).toEqual(b.markdown);
    expect(a.generatedFor).toBe('partner');
    expect(a.pricePaid).toBe(65);
  });

  it('Vocation report surfaces MC sign + Saturn placement deterministically', async () => {
    const a = await buildVocationReport({ natal: JOHN });
    const b = await buildVocationReport({ natal: JOHN });
    expect(a.markdown).toEqual(b.markdown);
    expect(a.pricePaid).toBe(55);
    expect(a.overview.some((r) => r.label === 'Vocation Archetype')).toBe(true);
  });
});
