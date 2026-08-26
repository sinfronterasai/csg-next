// F8-1: TRACEABLE EXTERNAL REFERENCE CORPUS.
//
// This corpus is sourced from an EXTERNAL, independent ephemeris authority:
//   NASA/JPL Horizons API (https://ssd.jpl.nasa.gov/api/horizons.api)
// which uses a different algorithm from the production Swiss Ephemeris engine.
// Raw JSON responses are committed under tests/reports/fixtures/jpl-raw/*.json,
// each tagged with response signature {"source":"NASA/JPL Horizons API","version":"1.2"}
// and the full query URL/parameters (see QUERY_LOG below).
//
// Quantity 31 = apparent observer-centered ecliptic-of-date longitude/latitude (degrees).
// Retrograde states are derived from the EXTERNALLY RETURNED ecliptic longitude direction
// between adjacent days (06-15 -> 06-16), using the raw JPL rows committed in planet_*_retro.json.
//
// ASC/MC and the mean-node value are NOT supplied by JPL and are kept as SECONDARY evidence
// from the independently documented Meeus angle calculation (Astronomical Algorithms, 2nd ed,
// 1998). They are NOT attributed to JPL. Production ASC/MC are compared to these secondary
// values within tolerance; the primary external assertion is Sun/Moon/planets/retrograde/fixture Moon.

export const SOURCE_METADATA = {
  primary: 'NASA/JPL Horizons API (https://ssd.jpl.nasa.gov/api/horizons.api)',
  primarySignature: { source: 'NASA/JPL Horizons API', version: '1.2' },
  primaryDocs: 'https://ssd-api.jpl.nasa.gov/doc/horizons.html',
  secondary: 'Meeus, Astronomical Algorithms, 2nd ed. (1998) — angle calculation only (ASC/MC/node)',
  retrieved: 'committed raw JPL JSON responses; fixed values parsed from them',
  quantity: '31 = apparent observer-centered ecliptic-of-date longitude (deg)',
  coordinateFrame: 'geocentric apparent, ecliptic-of-date',
  houseSystem: 'Placidus (ASC/MC angle calc secondary)',
  zodiac: 'tropical',
  tolerances: { bodyLongitude: 0.5, nodeLongitude: 1.6 },
} as const;

// Full JPL query URLs used (start<stop, STEP_SIZE=1h or 24h). Committed raw in jpl-raw/.
export const QUERY_LOG = {
  sunParis: "COMMAND='10' CENTER='500@399' QUANTITIES='31' 1990-06-15 09:00..11:00 STEP=1h -> sun_paris_1990-06-15T10.json",
  moonParis: "COMMAND='301' CENTER='500@399' QUANTITIES='31' 1990-06-15 09:00..11:00 STEP=1h -> moon_paris_1990-06-15T10.json",
  retro: "COMMAND in {599,699,799,899,999} CENTER='500@399' QUANTITIES='31' 1990-06-15 10:00..1990-06-16 10:00 STEP=24h -> planet_*_retro.json",
  moonSolarStart: "COMMAND='301' 1990-06-15 21:00..23:00 STEP=1h (Berlin 1990-06-16 00:00 = 06-15 22:00 UTC) -> moon_solar_start.json",
  moonSolarEnd: "COMMAND='301' 1990-06-16 20:59..22:59 STEP=1h (Berlin 1990-06-16 23:59 = 06-16 21:59 UTC) -> moon_solar_end.json",
  moonInvariantStart: "COMMAND='301' 1990-06-10 21:00..23:00 STEP=1h (Berlin 1990-06-11 00:00 = 06-10 22:00 UTC) -> moon_invariant_start.json",
  moonInvariantEnd: "COMMAND='301' 1990-06-11 20:59..22:59 STEP=1h (Berlin 1990-06-11 23:59 = 06-11 21:59 UTC) -> moon_invariant_end.json",
} as const;

export const REFERENCE_INSTANT = {
  utc: '1990-06-15T10:00:00Z',
  local: '1990-06-15 12:00 CEST',
  location: 'Paris',
  lat: 48.8566,
  lon: 2.3522,
  tzOffsetHours: 2,
} as const;

// FIXED EXPECTED values parsed from the committed JPL raw responses (PRIMARY external source).
export const FIXED_EXPECTED = {
  // JPL QUANTITY 31 at 1990-06-15 10:00 UTC
  sun: { longitude: 84.04995, sign: 'gemini' },
  moon: { longitude: 344.24579, sign: 'pisces' },
  // JPL 1-day direction (06-15 -> 06-16) of geocentric apparent ecliptic longitude.
  retrograde: ['neptune', 'pluto', 'saturn', 'uranus'],
  // Fixture Moon boundaries (JPL QUANTITY 31), with local-to-UTC conversion (Berlin = UTC+2).
  unknownTimeSolar: {
    dateLocal: '1990-06-16',
    location: 'Berlin',
    moonStart: { local: '00:00', utc: '1990-06-15T22:00:00Z', longitude: 350.956 },
    moonEnd: { local: '23:59', utc: '1990-06-16T21:59:00Z', longitude: 4.651 },
  },
  unknownTimeInvariantMoon: {
    dateLocal: '1990-06-11',
    location: 'Berlin',
    moonStart: { local: '00:00', utc: '1990-06-10T22:00:00Z', longitude: 287.098 },
    moonEnd: { local: '23:59', utc: '1990-06-11T21:59:00Z', longitude: 299.397 },
  },
  // SECONDARY (Meeus angle calc, NOT JPL): ASC/MC and mean-node.
  secondary: {
    ascendant: { longitude: 155.142, sign: 'virgo' },
    midheaven: { longitude: 58.035, sign: 'taurus' },
    northNodeMean: { longitude: 309.699, sign: 'aquarius' }, // engine uses TRUE node (documented ~1.6 spread)
  },
} as const;

export const TOLERANCES = { bodyLongitude: 0.5, nodeLongitude: 1.6 } as const;
