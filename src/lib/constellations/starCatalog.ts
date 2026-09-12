import {
  NAVIGATOR_FRAME_BASE,
  julianDayToJulianEpoch,

  propagateProperMotion,
  raDecToSceneVector,
  type NavigatorFrame,
  type SceneVector,
} from './coordinates';

export const STAR_CATALOG_PROVENANCE = {
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
} as const;

export type NamedStarCatalogRecord = {
  readonly key: string;
  readonly name: string;
  readonly hipparcosId: number;
  readonly rightAscensionRad: number;
  readonly declinationRad: number;
  readonly properMotionRaMasPerYear: number;
  readonly properMotionDecMasPerYear: number;
};

/**
 * Exact numeric fields selected from Hipparcos-2 I/311/hip2. Positions are
 * ICRS at observation epoch J1991.25; pmRA is mu-alpha-star.
 */
export const NAMED_STAR_CATALOG = [
  { key: 'sirius', name: 'Sirius', hipparcosId: 32349, rightAscensionRad: 1.7678185359, declinationRad: -0.2916993748, properMotionRaMasPerYear: -546.01, properMotionDecMasPerYear: -1223.07 },
  { key: 'betelgeuse', name: 'Betelgeuse', hipparcosId: 27989, rightAscensionRad: 1.5497279598, declinationRad: 0.1292771753, properMotionRaMasPerYear: 27.54, properMotionDecMasPerYear: 11.30 },
  { key: 'rigel', name: 'Rigel', hipparcosId: 24436, rightAscensionRad: 1.3724302998, declinationRad: -0.1431456148, properMotionRaMasPerYear: 1.31, properMotionDecMasPerYear: 0.50 },
  { key: 'aldebaran', name: 'Aldebaran', hipparcosId: 21421, rightAscensionRad: 1.2039281519, declinationRad: 0.2881496983, properMotionRaMasPerYear: 63.45, properMotionDecMasPerYear: -188.94 },
  { key: 'polaris', name: 'Polaris', hipparcosId: 11767, rightAscensionRad: 0.6622851337, declinationRad: 1.5579531082, properMotionRaMasPerYear: 44.48, properMotionDecMasPerYear: -11.85 },
  { key: 'vega', name: 'Vega', hipparcosId: 91262, rightAscensionRad: 4.8735545728, declinationRad: 0.6768909262, properMotionRaMasPerYear: 200.94, properMotionDecMasPerYear: 286.23 },
  { key: 'antares', name: 'Antares', hipparcosId: 80763, rightAscensionRad: 4.3171059089, declinationRad: -0.4613244851, properMotionRaMasPerYear: -12.11, properMotionDecMasPerYear: -23.30 },
  { key: 'capella', name: 'Capella', hipparcosId: 24608, rightAscensionRad: 1.3818132039, declinationRad: 0.8028345096, properMotionRaMasPerYear: 75.25, properMotionDecMasPerYear: -426.89 },
] as const satisfies readonly NamedStarCatalogRecord[];

export type NamedStarAtEpoch = {
  key: string;
  name: string;
  status: 'available';
  rightAscensionDeg: number;
  declinationDeg: number;
  vector: SceneVector;
  catalogId: string;
  catalogEpoch: typeof STAR_CATALOG_PROVENANCE.catalogEpoch;
  catalogFrame: typeof STAR_CATALOG_PROVENANCE.catalogFrame;
  source: 'Hipparcos-2 I/311/hip2';
  frame: NavigatorFrame;
};

function validateTargetEpoch(julianDayUt: number, epochIso: string): number {
  const targetJulianEpoch = julianDayToJulianEpoch(julianDayUt);
  if (typeof epochIso !== 'string') throw new RangeError('Target epoch must be a canonical ISO instant');
  const milliseconds = Date.parse(epochIso);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== epochIso) {
    throw new RangeError('Target epoch must be a canonical ISO instant');
  }
  const isoJulianDay = milliseconds / 86_400_000 + 2_440_587.5;
  if (Math.abs(isoJulianDay - julianDayUt) > 1e-8) {
    throw new RangeError('Target Julian day and epoch ISO instant mismatch');
  }
  return targetJulianEpoch;
}

/**
 * Propagate each catalog direction from J1991.25 in fixed ICRS. The target
 * observation epoch changes, while the ICRS axes remain fixed and unprecessed.
 */
export function getNamedStarsAtEpoch(julianDayUt: number, epochIso: string): NamedStarAtEpoch[] {
  const targetJulianEpoch = validateTargetEpoch(julianDayUt, epochIso);
  const frame: NavigatorFrame = { ...NAVIGATOR_FRAME_BASE, epoch: epochIso };

  return NAMED_STAR_CATALOG.map(record => {
    const propagated = propagateProperMotion({
      rightAscensionDeg: record.rightAscensionRad * 180 / Math.PI,
      declinationDeg: record.declinationRad * 180 / Math.PI,
      properMotionRaMasPerYear: record.properMotionRaMasPerYear,
      properMotionDecMasPerYear: record.properMotionDecMasPerYear,
      fromJulianEpoch: 1991.25,
      toJulianEpoch: targetJulianEpoch,
    });
    return {
      key: record.key,
      name: record.name,
      status: 'available' as const,
      rightAscensionDeg: propagated.rightAscensionDeg,
      declinationDeg: propagated.declinationDeg,
      vector: raDecToSceneVector(propagated.rightAscensionDeg, propagated.declinationDeg),
      catalogId: `HIP ${record.hipparcosId}`,
      catalogEpoch: STAR_CATALOG_PROVENANCE.catalogEpoch,
      catalogFrame: STAR_CATALOG_PROVENANCE.catalogFrame,
      source: 'Hipparcos-2 I/311/hip2' as const,
      frame,
    };
  });
}
