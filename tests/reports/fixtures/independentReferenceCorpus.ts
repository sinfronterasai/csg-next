// F7-1: CHECKED-IN static reference corpus.
//
// Fixed expected values for the Paris 1990-06-15 12:00 CEST birth, retrieved/computed
// from an INDEPENDENT astronomical source -- Jean Meeus, "Astronomical Algorithms",
// 2nd edition, Willmann-Bell (1998) -- NOT from the production Swiss Ephemeris engine.
// These are recorded constants; the tests compare production output directly to them.
//
// Source details (recording requirement):
//   Source/product : Meeus, Astronomical Algorithms, 2nd ed. (1998)
//   URL            : https://aa.quae.nl/en/reken/hemelpositie.html (independent confirmation)
//   Retrieved      : computed locally from the cited algorithms (fixed output checked in)
//   UTC instant    : 1990-06-15T10:00:00Z  (Paris 12:00 CEST = UTC+2)
//   Coordinates    : lon +2.3522 deg, lat +48.8566 deg (Paris)
//   House system   : Placidus (ASC/MC are RAMC-derived; house cusps not asserted here)
//   Zodiac         : tropical (no ayanamsha)
//   Node type      : mean ascending (independent) vs true (engine)
//   Tolerances     : 0.5 deg for Sun/Moon/ASC/MC; 1.6 deg for Node (mean<->true spread)
//
// Retrograde is determined independently via geocentric longitude (planet heliocentric
// minus Earth heliocentric position) and the sign of its 1-day apparent motion.
//
// The production engine under test is Swiss Ephemeris (src/lib/chartEngine). This corpus
// is a SECOND, independent computation and is NOT the production engine.

export const REFERENCE_INSTANT = {
  utc: '1990-06-15T10:00:00Z',
  local: '1990-06-15 12:00 CEST',
  location: 'Paris',
  lat: 48.8566,
  lon: 2.3522,
  tzOffsetHours: 2,
} as const;

export const SOURCE_METADATA = {
  product: 'Meeus, Astronomical Algorithms, 2nd ed. (1998)',
  url: 'https://aa.quae.nl/en/reken/hemelpositie.html',
  retrieved: 'computed locally from cited algorithms; fixed output checked in',
  houseSystem: 'Placidus',
  zodiac: 'tropical',
  nodeType: 'mean ascending (independent) vs true (engine)',
  tolerances: { bodyLongitude: 0.5, nodeLongitude: 1.6 },
} as const;

export const FIXED_EXPECTED = {
  sun: { longitude: 84.054, sign: 'gemini' },
  moon: { longitude: 344.375, sign: 'pisces' },
  ascendant: { longitude: 155.142, sign: 'virgo' },
  midheaven: { longitude: 58.035, sign: 'taurus' },
  // Mean ascending node (independent); engine emits true node (documented spread).
  northNodeMean: { longitude: 309.699, sign: 'aquarius' },
  // Independent retrograde set (geocentric 1-day apparent motion sign).
  retrograde: ['neptune', 'pluto', 'saturn', 'uranus'],
} as const;

export const TOLERANCES = { bodyLongitude: 0.5, nodeLongitude: 1.6 } as const;
