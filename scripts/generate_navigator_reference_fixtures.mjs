#!/usr/bin/env node
// Independently regenerate the committed Cosmic Navigator reference fixtures.
// This script intentionally does not import any production Navigator utility.
import { readFileSync } from 'node:fs';
import { load, Constants } from '@fusionstrings/swiss-eph';

const jd = 2444308.5145833334;
const epochIso = '1980-03-10T00:21:00.000Z';
const flags = Constants.SEFLG_SWIEPH | Constants.SEFLG_EQUATORIAL | Constants.SEFLG_XYZ |
  Constants.SEFLG_J2000 | Constants.SEFLG_NONUT | Constants.SEFLG_NOABERR |
  Constants.SEFLG_NOGDEFL | Constants.SEFLG_ICRS;
const eph = await load(readFileSync('node_modules/@fusionstrings/swiss-eph/wasm/swiss_eph.wasm'));
for (const name of ['seas_18.se1', 'semo_18.se1', 'sepl_18.se1']) eph.mount(name, readFileSync(`data/ephemeris/${name}`));
eph.set_ephe_path('.');
const result = eph.swe_calc_ut(jd, Constants.SE_SUN, flags);
if (result.returnCode < 0) throw new Error(result.error || 'Swiss calculation failed');
const [eqX, eqY, eqZ] = result.xx;
const eqLength = Math.hypot(eqX, eqY, eqZ);
const planet = {
  rightAscensionDeg: ((Math.atan2(eqY, eqX) * 180 / Math.PI) + 360) % 360,
  declinationDeg: Math.asin(eqZ / eqLength) * 180 / Math.PI,
  vector: { x: eqX / eqLength, y: eqZ / eqLength, z: -eqY / eqLength },
};

// Independent tangent-plane propagation of the authoritative HIP 32349 row.
const ra = 1.7678185359;
const dec = -0.2916993748;
const years = 2000 + (jd - 2451545) / 365.25 - 1991.25;
const masToRad = Math.PI / 180 / 3_600_000;
const muRa = -546.01 * masToRad * years;
const muDec = -1223.07 * masToRad * years;
const moved = {
  x: Math.cos(dec) * Math.cos(ra) - muRa * Math.sin(ra) - muDec * Math.sin(dec) * Math.cos(ra),
  y: Math.cos(dec) * Math.sin(ra) + muRa * Math.cos(ra) - muDec * Math.sin(dec) * Math.sin(ra),
  z: Math.sin(dec) + muDec * Math.cos(dec),
};
const movedLength = Math.hypot(moved.x, moved.y, moved.z);
const starRa = ((Math.atan2(moved.y, moved.x) * 180 / Math.PI) + 360) % 360;
const starDec = Math.asin(moved.z / movedLength) * 180 / Math.PI;
const star = {
  rightAscensionDeg: starRa,
  declinationDeg: starDec,
  vector: {
    x: Math.cos(starDec * Math.PI / 180) * Math.cos(starRa * Math.PI / 180),
    y: Math.sin(starDec * Math.PI / 180),
    z: -Math.cos(starDec * Math.PI / 180) * Math.sin(starRa * Math.PI / 180),
  },
};
console.log(JSON.stringify({
  generatedBy: 'scripts/generate_navigator_reference_fixtures.mjs',
  tool: '@fusionstrings/swiss-eph 0.1.1 / Swiss Ephemeris 2.10.03 plus independent ECMAScript tangent-plane arithmetic',
  julianDayUt: jd,
  epochIso,
  swissFlags: flags,
  planet: { body: 'Sun', swissBodyId: Constants.SE_SUN, ...planet },
  star: { catalogId: 'HIP 32349', ...star },
}, null, 2));
