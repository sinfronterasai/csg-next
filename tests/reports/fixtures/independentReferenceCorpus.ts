// F10-1 / F10-2 / F9-2 / EXTERNAL-CHART-UNBLOCK: TRACEABLE EXTERNAL REFERENCE CORPUS.
//
// PRIMARY independent astronomical cross-check: NASA/JPL Horizons API raw responses
// (signature {"source":"NASA/JPL Horizons API","version":"1.2"}), committed under
// tests/reports/fixtures/jpl-raw/*.json. Every fixed constant is parsed from a committed
// raw row and linked to its exact query (see factsV2-independent-ephemeris.test.ts).
//
// SECONDARY external chart-service result: CosmyDay (https://cosmyday.com), committed raw
// under tests/reports/fixtures/jpl-raw/cosmyday-paris-1990-06-15T12-local.json. Its docs
// state it computes with Swiss Ephemeris, so it is an EXTERNAL SERVICE RESULT, not an
// algorithmically independent engine. It supplies the external ASC, MC, selected node, and
// the complete standard-planet retrograde determination used to derive FIXED_EXPECTED.retrograde.

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

// F10-1: each JPL query is generated from a machine-readable parameter object and encoded
// deterministically (encodeURIComponent per value + '&' join). No fragile string replacement.
interface JplQuery {
  COMMAND: string; OBJ_DATA: string; MAKE_EPHEM: string; EPHEM_TYPE: string; CENTER: string;
  START_TIME: string; STOP_TIME: string; STEP_SIZE: string; QUANTITIES: string; CSV_FORMAT: string; ANG_FORMAT: string;
}
const JPL_BASE_PARAMS: Omit<JplQuery, 'COMMAND' | 'START_TIME' | 'STOP_TIME' | 'STEP_SIZE'> = {
  OBJ_DATA: "'NO'", MAKE_EPHEM: "'YES'", EPHEM_TYPE: "'OBSERVER'", CENTER: "'500@399'",
  QUANTITIES: "'31'", CSV_FORMAT: "'YES'", ANG_FORMAT: "'DEG'",
};
function buildJplUrl(cmd: string, start: string, stop: string, step: string): string {
  const q: JplQuery = {
    ...JPL_BASE_PARAMS,
    COMMAND: `'${cmd}'`, START_TIME: `'${start}'`, STOP_TIME: `'${stop}'`, STEP_SIZE: `'${step}'`,
  };
  const qs = Object.entries(q).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  return `https://ssd.jpl.nasa.gov/api/horizons.api?format=json&${qs}`;
}
// F10-JPL: ONE manifest row owns file, queryKey, command/target token, center token, the
// exact artifact window, row count, selected timestamp and selected longitude. These windows
// ARE the committed raw artifact header windows — no separate "intended" windows exist.
// QUERY_LOG is generated from these same rows, so a query and its artifact cannot drift.
export interface JplManifestRow {
  file: string;
  queryKey: string;
  command: string;
  target: string;
  center: string;
  start: string;
  stop: string;
  step: '1 h' | '1 d';
  stepMinutes: 60 | 1440;
  timestamps: string[];
  expRows: number;
  timeToken: string;
  expLon: number;
  // F11-4: explicitly declared rounding precision that ties expLon to the parsed raw
  // ObsEcLon value of the selected row: round(rawLon, lonDp) === expLon, exactly.
  lonDp: number;
}

// F11-4: every manifest row declares lonDp = 5, the exact precision at which its expLon is
// the rounded parsed ObsEcLon of its selected raw row. No tolerance band is used.
export const JPL_LON_DP = 5;
export const JPL_MANIFEST: JplManifestRow[] = [
  {
    file: 'sun_paris_1990-06-15T10.json', queryKey: 'sun_paris_1990_06_15T10', command: '10',
    target: 'Sun (10)', center: 'Earth (399)', start: '1990-06-15 09:00', stop: '1990-06-15 11:00',
    step: '1 h', stepMinutes: 60, timestamps: ['1990-Jun-15 09:00', '1990-Jun-15 10:00', '1990-Jun-15 11:00'],
    expRows: 3, timeToken: '1990-Jun-15 10:00', expLon: 84.04995, lonDp: 5,
  },
  {
    file: 'moon_paris_1990-06-15T10.json', queryKey: 'moon_paris_1990_06_15T10', command: '301',
    target: 'Moon (301)', center: 'Earth (399)', start: '1990-06-15 09:00', stop: '1990-06-15 11:00',
    step: '1 h', stepMinutes: 60, timestamps: ['1990-Jun-15 09:00', '1990-Jun-15 10:00', '1990-Jun-15 11:00'],
    expRows: 3, timeToken: '1990-Jun-15 10:00', expLon: 344.24579, lonDp: 5,
  },
  {
    file: 'moon_solar_start.json', queryKey: 'moon_solar_start', command: '301',
    target: 'Moon (301)', center: 'Earth (399)', start: '1990-06-15 21:00', stop: '1990-06-15 23:00',
    step: '1 h', stepMinutes: 60, timestamps: ['1990-Jun-15 21:00', '1990-Jun-15 22:00', '1990-Jun-15 23:00'],
    expRows: 3, timeToken: '1990-Jun-15 22:00', expLon: 350.95686, lonDp: 5,
  },
  {
    file: 'moon_solar_end.json', queryKey: 'moon_solar_end', command: '301',
    target: 'Moon (301)', center: 'Earth (399)', start: '1990-06-16 20:59', stop: '1990-06-16 22:59',
    step: '1 h', stepMinutes: 60, timestamps: ['1990-Jun-16 20:59', '1990-Jun-16 21:59', '1990-Jun-16 22:59'],
    expRows: 3, timeToken: '1990-Jun-16 21:59', expLon: 4.65108, lonDp: 5,
  },
  {
    file: 'moon_invariant_start.json', queryKey: 'moon_invariant_start', command: '301',
    target: 'Moon (301)', center: 'Earth (399)', start: '1990-06-10 21:00', stop: '1990-06-10 23:00',
    step: '1 h', stepMinutes: 60, timestamps: ['1990-Jun-10 21:00', '1990-Jun-10 22:00', '1990-Jun-10 23:00'],
    expRows: 3, timeToken: '1990-Jun-10 22:00', expLon: 287.09834, lonDp: 5,
  },
  {
    file: 'moon_invariant_end.json', queryKey: 'moon_invariant_end', command: '301',
    target: 'Moon (301)', center: 'Earth (399)', start: '1990-06-11 20:59', stop: '1990-06-11 22:59',
    step: '1 h', stepMinutes: 60, timestamps: ['1990-Jun-11 20:59', '1990-Jun-11 21:59', '1990-Jun-11 22:59'],
    expRows: 3, timeToken: '1990-Jun-11 21:59', expLon: 299.39723, lonDp: 5,
  },
  {
    file: 'planet_199_retro.json', queryKey: 'planet_199_retro', command: '199',
    target: 'Mercury (199)', center: 'Earth (399)', start: '1990-06-15 09:00', stop: '1990-06-15 11:00',
    step: '1 h', stepMinutes: 60, timestamps: ['1990-Jun-15 09:00', '1990-Jun-15 10:00', '1990-Jun-15 11:00'],
    expRows: 3, timeToken: '1990-Jun-15 10:00', expLon: 65.54785, lonDp: 5,
  },
  {
    file: 'planet_299_retro.json', queryKey: 'planet_299_retro', command: '299',
    target: 'Venus (299)', center: 'Earth (399)', start: '1990-06-15 09:00', stop: '1990-06-15 11:00',
    step: '1 h', stepMinutes: 60, timestamps: ['1990-Jun-15 09:00', '1990-Jun-15 10:00', '1990-Jun-15 11:00'],
    expRows: 3, timeToken: '1990-Jun-15 10:00', expLon: 48.67959, lonDp: 5,
  },
  {
    file: 'planet_499_retro.json', queryKey: 'planet_499_retro', command: '499',
    target: 'Mars (499)', center: 'Earth (399)', start: '1990-06-15 09:00', stop: '1990-06-15 11:00',
    step: '1 h', stepMinutes: 60, timestamps: ['1990-Jun-15 09:00', '1990-Jun-15 10:00', '1990-Jun-15 11:00'],
    expRows: 3, timeToken: '1990-Jun-15 10:00', expLon: 10.98138, lonDp: 5,
  },
  {
    file: 'planet_599_retro.json', queryKey: 'planet_599_retro', command: '599',
    target: 'Jupiter (599)', center: 'Earth (399)', start: '1990-06-15 10:00', stop: '1990-06-16 10:00',
    step: '1 d', stepMinutes: 1440, timestamps: ['1990-Jun-15 10:00', '1990-Jun-16 10:00'],
    expRows: 2, timeToken: '1990-Jun-15 10:00', expLon: 105.87143, lonDp: 5,
  },
  {
    file: 'planet_699_retro.json', queryKey: 'planet_699_retro', command: '699',
    target: 'Saturn (699)', center: 'Earth (399)', start: '1990-06-15 10:00', stop: '1990-06-16 10:00',
    step: '1 d', stepMinutes: 1440, timestamps: ['1990-Jun-15 10:00', '1990-Jun-16 10:00'],
    expRows: 2, timeToken: '1990-Jun-15 10:00', expLon: 294.03681, lonDp: 5,
  },
  {
    file: 'planet_799_retro.json', queryKey: 'planet_799_retro', command: '799',
    target: 'Uranus (799)', center: 'Earth (399)', start: '1990-06-15 10:00', stop: '1990-06-16 10:00',
    step: '1 d', stepMinutes: 1440, timestamps: ['1990-Jun-15 10:00', '1990-Jun-16 10:00'],
    expRows: 2, timeToken: '1990-Jun-15 10:00', expLon: 278.16844, lonDp: 5,
  },
  {
    file: 'planet_899_retro.json', queryKey: 'planet_899_retro', command: '899',
    target: 'Neptune (899)', center: 'Earth (399)', start: '1990-06-15 10:00', stop: '1990-06-16 10:00',
    step: '1 d', stepMinutes: 1440, timestamps: ['1990-Jun-15 10:00', '1990-Jun-16 10:00'],
    expRows: 2, timeToken: '1990-Jun-15 10:00', expLon: 283.71915, lonDp: 5,
  },
  {
    file: 'planet_999_retro.json', queryKey: 'planet_999_retro', command: '999',
    target: 'Pluto (999)', center: 'Earth (399)', start: '1990-06-15 10:00', stop: '1990-06-16 10:00',
    step: '1 d', stepMinutes: 1440, timestamps: ['1990-Jun-15 10:00', '1990-Jun-16 10:00'],
    expRows: 2, timeToken: '1990-Jun-15 10:00', expLon: 225.40317, lonDp: 5,
  },
];

export const QUERY_LOG: Record<string, string> = Object.fromEntries(
  JPL_MANIFEST.map((r) => [r.queryKey, buildJplUrl(r.command, r.start, r.stop, r.step)]),
);

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

// F10-2: fixed external values. ASC/MC/node signs are derived deterministically from the
// EXTERNAL longitude (tropical, 30°/sign). 58.0384° -> Taurus (index 1), NOT Virgo.
export const FIXED_EXPECTED = {
  sun: { longitude: 84.04995, sign: 'gemini' },
  moon: { longitude: 344.24579, sign: 'pisces' },
  ascendant: { longitude: 155.1452, sign: 'virgo' },
  midheaven: { longitude: 58.0384, sign: 'taurus' },
  northNode: { longitude: 308.1207, sign: 'aquarius' },
  retrograde: ['saturn', 'uranus', 'neptune', 'pluto'],
  unknownTimeSolar: {
    moonStart: { utc: '1990-06-15T22:00:00Z', local: '1990-06-16T00:00:00+02:00', longitude: 350.95686 },
    moonEnd: { utc: '1990-06-16T21:59:00Z', local: '1990-06-16T23:59:00+02:00', longitude: 4.65108 },
  },
  unknownTimeInvariantMoon: {
    moonStart: { utc: '1990-06-10T22:00:00Z', local: '1990-06-11T00:00:00+02:00', longitude: 287.09834 },
    moonEnd: { utc: '1990-06-11T21:59:00Z', local: '1990-06-11T23:59:00+02:00', longitude: 299.39723 },
  },
};

export const TOLERANCES = {
  bodyLongitude: 0.5,
  nodeLongitude: 1.6,
};
