// F9-1 / F9-2 / EXTERNAL-CHART-UNBLOCK: TRACEABLE EXTERNAL REFERENCE CORPUS.
//
// PRIMARY independent astronomical cross-check: NASA/JPL Horizons API raw responses
// (signature {"source":"NASA/JPL Horizons API","version":"1.2"}), committed under
// tests/reports/fixtures/jpl-raw/*.json. Every fixed constant below is parsed from a
// committed raw row (see the parse-linked test in factsV2-independent-ephemeris.test.ts).
//
// SECONDARY external chart-service result: CosmyDay (https://cosmyday.com), committed raw
// under tests/reports/fixtures/jpl-raw/cosmyday-paris-1990-06-15T12-local.json. Its docs
// state it computes with Swiss Ephemeris, so it is an EXTERNAL SERVICE RESULT, not an
// algorithmically independent engine. It supplies the external ASC, MC, selected node, and
// the complete standard-planet retrograde determination used to derive FIXED_EXPECTED.retrograde.
//
// Attribution rule: JPL = primary astronomical cross-check (Sun/Moon/planet positions,
// unknown-time Moon boundaries). CosmyDay = external service result for ASC/MC/node + retrograde.

export const REFERENCE_INSTANT = {
  utc: '1990-06-15T10:00:00Z',
  local: '1990-06-15T12:00:00+02:00',
  location: 'Paris',
  lat: 48.8566,
  lon: 2.3522,
  timezone: 'Europe/Paris',
  utcOffset: 2,
};

export const SOURCE_METADATA = {
  primary: 'NASA/JPL Horizons API (https://ssd.jpl.nasa.gov/api/horizons.api)',
  secondary: 'CosmyDay API (https://api.cosmyday.com/natal) — Swiss-Ephemeris-based external service',
  zodiac: 'tropical',
  houseSystem: 'Placidus',
  retrieved: '2026-08-26T22:05:35Z',
  cosmydayRetrieved: '2026-08-26T22:05:35Z',
  cosmydayResponseSha256: '977c48a3d9c918f88be2bb49b108a7a3a50fff7e9b7d1dbe22310a9abdd3077f',
  cosmydayDocs: 'https://cosmyday.com/api-docs',
  nodeType: 'true-north-node',
};

// F9-1: exact encoded JPL query URLs (machine-readable; every value contains the full
// method/params so the test can assert MAKE_EPHEM / STEP_SIZE / CSV_FORMAT are present).
const JPL_BASE = 'https://ssd.jpl.nasa.gov/api/horizons.api?format=json&COMMAND=%27__CMD__%27&OBJ_DATA=%27NO%27&MAKE_EPHEM=%27YES%27&EPHEM_TYPE=%27OBSERVER%27&CENTER=%27500@399%27&START_TIME=%271990-06-15+09%3A00%27&STOP_TIME=%271990-06-15+11%3A00%27&STEP_SIZE=%271+h%27&QUANTITIES=%2731%27&CSV_FORMAT=%27YES%27&ANG_FORMAT=%27DEG%27';
export const QUERY_LOG: Record<string, string> = {
  sun_paris_1990_06_15T10: JPL_BASE.replace('__CMD__', '10'),
  moon_paris_1990_06_15T10: JPL_BASE.replace('__CMD__', '301'),
  planet_199_retro: JPL_BASE.replace('__CMD__', '199'),
  planet_299_retro: JPL_BASE.replace('__CMD__', '299'),
  planet_499_retro: JPL_BASE.replace('__CMD__', '499'),
  planet_599_retro: JPL_BASE.replace('__CMD__', '599'),
  planet_699_retro: JPL_BASE.replace('__CMD__', '699'),
  planet_799_retro: JPL_BASE.replace('__CMD__', '799'),
  planet_899_retro: JPL_BASE.replace('__CMD__', '899'),
  planet_999_retro: JPL_BASE.replace('__CMD__', '999'),
  moon_solar_start: JPL_BASE.replace('__CMD__', '301').replace('1990-06-15%2009%3A00', '1990-06-15%2021%3A00').replace('1990-06-15%2011%3A00', '1990-06-16%2001%3A00'),
  moon_solar_end: JPL_BASE.replace('__CMD__', '301').replace('1990-06-15%2009%3A00', '1990-06-16%2020%3A00').replace('1990-06-15%2011%3A00', '1990-06-16%2022%3A00'),
  moon_invariant_start: JPL_BASE.replace('__CMD__', '301').replace('1990-06-15%2009%3A00', '1990-06-10%2021%3A00').replace('1990-06-15%2011%3A00', '1990-06-11%2001%3A00'),
  moon_invariant_end: JPL_BASE.replace('__CMD__', '301').replace('1990-06-15%2009%3A00', '1990-06-11%2020%3A00').replace('1990-06-15%2011%3A00', '1990-06-11%2022%3A00'),
};

// Machine-readable external chart-service manifest (CosmyDay).
export const EXTERNAL_CHART_REQUEST = {
  method: 'POST',
  url: 'https://api.cosmyday.com/natal',
  headers: { 'Content-Type': 'application/json', 'User-Agent': 'CosmicSpiritGuide-R5-Reference/1.0' },
  body: { year: 1990, month: 6, day: 15, hour: 12, minute: 0, lat: 48.8566, lon: 2.3522 },
  retrievalTimestamp: '2026-08-26T22:05:35Z',
  responseSha256: '977c48a3d9c918f88be2bb49b108a7a3a50fff7e9b7d1dbe22310a9abdd3077f',
  houseSystem: 'Placidus',
  zodiac: 'tropical',
  coordinates: { lat: 48.8566, lon: 2.3522 },
  localTime: '1990-06-15T12:00:00+02:00',
  timezoneConversion: 'local+02:00 -> 1990-06-15T10:00:00Z',
  selectedNodeType: 'true-north-node',
  docsUrl: 'https://cosmyday.com/api-docs',
  rawFile: 'tests/reports/fixtures/jpl-raw/cosmyday-paris-1990-06-15T12-local.json',
};

// F9-2: fixed external values. Sun/Moon + unknown-time boundaries from JPL (primary).
// ASC/MC/selected-node + retrograde from CosmyDay (external service result).
export const FIXED_EXPECTED = {
  sun: { longitude: 84.04995, sign: 'gemini' },
  moon: { longitude: 344.2458, sign: 'pisces' },
  // External chart-service values (CosmyDay, Swiss-Ephemeris-based; external result, not engine).
  ascendant: { longitude: 155.1452, sign: 'virgo' },
  midheaven: { longitude: 58.0384, sign: 'virgo' },
  northNode: { longitude: 308.1207, sign: 'aquarius' },
  // Retrograde set is DERIVED from CosmyDay planets[*].retrograde in the test; this is the
  // expected result of that derivation (Mercury/Venus/Mars/Jupiter direct; Saturn/Uranus/Neptune/Pluto retro).
  retrograde: ['saturn', 'uranus', 'neptune', 'pluto'],
  unknownTimeSolar: {
    moonStart: { utc: '1990-06-15T22:00:00Z', local: '1990-06-16T00:00:00+02:00', longitude: 350.956 },
    moonEnd: { utc: '1990-06-16T21:59:00Z', local: '1990-06-16T23:59:00+02:00', longitude: 4.651 },
  },
  unknownTimeInvariantMoon: {
    moonStart: { utc: '1990-06-10T22:00:00Z', local: '1990-06-11T00:00:00+02:00', longitude: 287.098 },
    moonEnd: { utc: '1990-06-11T21:59:00Z', local: '1990-06-11T23:59:00+02:00', longitude: 299.397 },
  },
};

export const TOLERANCES = {
  bodyLongitude: 0.5,
  nodeLongitude: 1.6,
};
