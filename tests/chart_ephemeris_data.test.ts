import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { load, Constants } from '@fusionstrings/swiss-eph';
import { mountEphemerisData, EPHEMERIS_FILES } from '@/lib/ephemerisData';

it.each(['absent', 'corrupt'])('keeps real core calculation available with an %s bundle, without mounting fake asteroids', async condition => {
  const directory = mkdtempSync(join(tmpdir(), 'csg-ephe-'));
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    if (condition === 'corrupt') for (const file of Object.keys(EPHEMERIS_FILES)) writeFileSync(join(directory, file), 'not an ephemeris');
    const eph = await load(readFileSync('node_modules/@fusionstrings/swiss-eph/wasm/swiss_eph.wasm'));
    expect(mountEphemerisData(eph, directory)).toBe(false);
    const jd = Date.UTC(1980, 2, 10, 0, 21) / 86400000 + 2440587.5;
    expect(eph.swe_calc_ut(jd, Constants.SE_SUN, 258).returnCode).toBeGreaterThan(0);
    expect(eph.swe_calc_ut(jd, Constants.SE_CHIRON, 258).returnCode).toBe(-1);
    expect(eph.swe_calc_ut(jd, Constants.SE_JUNO, 258).returnCode).toBe(-1);
  } finally { rmSync(directory, { recursive: true, force: true }); warn.mockRestore(); }
});
