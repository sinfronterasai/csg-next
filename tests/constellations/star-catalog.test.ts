import {
  NAMED_STAR_CATALOG,
  STAR_CATALOG_PROVENANCE,
  getNamedStarsAtEpoch,
} from '@/lib/constellations/starCatalog';
import { NAVIGATOR_FRAME_BASE } from '@/lib/constellations/coordinates';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';

const EXPECTED_IDENTITIES = [
  ['sirius', 'Sirius', 32349], ['betelgeuse', 'Betelgeuse', 27989], ['rigel', 'Rigel', 24436],
  ['aldebaran', 'Aldebaran', 21421], ['polaris', 'Polaris', 11767], ['vega', 'Vega', 91262],
  ['antares', 'Antares', 80763], ['capella', 'Capella', 24608],
] as const;
const independentFixture = JSON.parse(readFileSync(join(process.cwd(), 'data/astronomy/cosmic-navigator-independent-fixtures.json'), 'utf8'));

describe('committed Hipparcos-2 named-star catalog', () => {
  it('contains exactly the required eight records in product order with exact source values', () => {
    expect(NAMED_STAR_CATALOG).toHaveLength(8);
    expect(NAMED_STAR_CATALOG.map(star => [star.key, star.name, star.hipparcosId])).toEqual(EXPECTED_IDENTITIES);
    expect(new Set(NAMED_STAR_CATALOG.map(star => star.hipparcosId)).size).toBe(8);
  });

  it('locks exact catalog provenance, frame, epoch, and canonical subset hash', () => {
    expect(STAR_CATALOG_PROVENANCE).toEqual({
      catalog: 'Hipparcos, the New Reduction',
      table: 'I/311/hip2',
      release: 'CDS/VizieR iteration-14 astrometric catalogue (van Leeuwen 2007)',
      sourceUrl: 'https://cdsarc.cds.unistra.fr/ftp/cats/I/311/hip2.dat.gz',
      catalogFrame: 'ICRS',
      catalogEpoch: 'J1991.25',
      positionUnit: 'radian',
      properMotionUnit: 'milliarcsecond-per-Julian-year',
      properMotionRaConvention: 'mu_alpha_star = d(alpha)/dt * cos(delta)',
      retrievedOn: '2026-09-12',
      sourceArchiveSha256: '8e624f843d4254a9b7c2e8dda8e3158dbe825bf98f6bf3dbbae7f0d0b73d6858',
      rawSubsetSha256: '9c3199397015df74aa40bc60faa93709e9ecf8d209a2c9687db63e3c55bb6d96',
      canonicalSubsetSha256: 'ccd968659b5691276ea5c2f55884bbfad113507d78b2ef7debe1b5c2b1b7a0d7',
      extractionScript: 'scripts/extract_hip2_named_stars.py',
    });
    const rawBytes = readFileSync(join(process.cwd(), 'data/astronomy/hipparcos2-named-stars.raw.txt'));
    const canonicalBytes = readFileSync(join(process.cwd(), 'data/astronomy/hipparcos2-named-stars.canonical.csv'));
    expect(createHash('sha256').update(rawBytes).digest('hex')).toBe(STAR_CATALOG_PROVENANCE.rawSubsetSha256);
    expect(createHash('sha256').update(canonicalBytes).digest('hex')).toBe(STAR_CATALOG_PROVENANCE.canonicalSubsetSha256);
    const rawByHip = new Map(rawBytes.toString('ascii').trim().split('\n').map(line => {
      const fields = line.trim().split(/\s+/);
      const [hip, ra, dec, pmRa, pmDec] = [fields[0], fields[4], fields[5], fields[7], fields[8]].map(Number);
      return [hip, { ra, dec, pmRa, pmDec }];
    }));
    for (const record of NAMED_STAR_CATALOG) {
      expect(rawByHip.get(record.hipparcosId)).toEqual({
        ra: record.rightAscensionRad,
        dec: record.declinationRad,
        pmRa: record.properMotionRaMasPerYear,
        pmDec: record.properMotionDecMasPerYear,
      });
    }
  });

  it('serializes all stars into one target frame and one target epoch with unit scene vectors', () => {
    const epochIso = '2000-01-01T12:00:00.000Z';
    const stars = getNamedStarsAtEpoch(2451545, epochIso);
    expect(stars.map(star => star.key)).toEqual(EXPECTED_IDENTITIES.map(row => row[0]));
    for (const star of stars) {
      expect(star).toMatchObject({
        status: 'available',
        catalogId: `HIP ${NAMED_STAR_CATALOG.find(record => record.key === star.key)!.hipparcosId}`,
        catalogEpoch: 'J1991.25',
        catalogFrame: 'ICRS',
        source: 'Hipparcos-2 I/311/hip2',
        frame: { ...NAVIGATOR_FRAME_BASE, epoch: epochIso },
      });
      expect(star.rightAscensionDeg).toBeGreaterThanOrEqual(0);
      expect(star.rightAscensionDeg).toBeLessThan(360);
      expect(star.declinationDeg).toBeGreaterThanOrEqual(-90);
      expect(star.declinationDeg).toBeLessThanOrEqual(90);
      expect(Math.abs(Math.hypot(star.vector.x, star.vector.y, star.vector.z) - 1)).toBeLessThanOrEqual(1e-12);
    }
  });

  it('matches an independently prepared J2000 Sirius fixture', () => {
    // Independent tangent-plane fixture in fixed ICRS axes (no precession).
    const sirius = getNamedStarsAtEpoch(2451545, '2000-01-01T12:00:00.000Z')[0];
    expect(sirius.rightAscensionDeg).toBeCloseTo(101.28715533, 6);
    expect(sirius.declinationDeg).toBeCloseTo(-16.71611586, 6);
    expect(sirius.vector.x).toBeCloseTo(-0.18745523, 7);
    expect(sirius.vector.y).toBeCloseTo(-0.28762992, 7);
    expect(sirius.vector.z).toBeCloseTo(-0.93921753, 7);
  });

  it('matches an independent non-J2000 Sirius proper-motion fixture without precession', () => {
    const sirius = getNamedStarsAtEpoch(2444308.5145833334, '1980-03-10T00:21:00.000Z')[0];
    expect(independentFixture.generatedBy).toBe('scripts/generate_navigator_reference_fixtures.mjs');
    expect(sirius.rightAscensionDeg).toBeCloseTo(independentFixture.star.rightAscensionDeg, 8);
    expect(sirius.declinationDeg).toBeCloseTo(independentFixture.star.declinationDeg, 8);
    expect(sirius.vector.x).toBeCloseTo(independentFixture.star.vector.x, 10);
    expect(sirius.vector.y).toBeCloseTo(independentFixture.star.vector.y, 10);
    expect(sirius.vector.z).toBeCloseTo(independentFixture.star.vector.z, 10);
  });

  it.each([
    [NaN, '2000-01-01T12:00:00.000Z'],
    [Infinity, '2000-01-01T12:00:00.000Z'],
    [2451545, 'not-an-iso-epoch'],
    [2451545, '2000-01-02T12:00:00.000Z'],
  ])('rejects invalid or mismatched target epoch input %#', (julianDay, epochIso) => {
    expect(() => getNamedStarsAtEpoch(julianDay as number, epochIso as string)).toThrow(RangeError);
  });
});
