import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { SwissEph } from '@fusionstrings/swiss-eph';

// Upstream provenance/licensing and provisioning instructions: docs/ephemeris-provisioning.md.
// Pin the complete 1800–2399 bundle, not mutable upstream URLs or arbitrary files.
export const EPHEMERIS_FILES = {
  'seas_18.se1': 'a2cd8fc33807c78ca9a700c91c2e042258b12fc4796519e00781440b5ad8b2e2',
  'semo_18.se1': '1ca07bd67c24374d77226180c20a4f9996cba013697894810518e7eb582ca4f7',
  'sepl_18.se1': 'ca1393ceab3a44fbc895887cf789c68819ae6a1cbc9b22225872dbe4ccd99a66',
} as const;

export function mountEphemerisData(eph: SwissEph, directory = process.env.SWISS_EPHEMERIS_DIR || join(process.cwd(), 'data/ephemeris')): boolean {
  // Validate every byte before mounting any part of the bundle. A missing or
  // corrupt bundle retains the original core-only chart / closed report behavior.
  let files: [string, Buffer][];
  try {
    files = Object.entries(EPHEMERIS_FILES).map(([name, expected]) => {
      const bytes = readFileSync(join(directory, name));
      if (createHash('sha256').update(bytes).digest('hex') !== expected) throw new Error(`Checksum mismatch: ${name}`);
      return [name, bytes];
    });
  } catch (error) {
    if (process.env.SWISS_EPHEMERIS_DIR || (error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn('Swiss Ephemeris data not mounted; complete reports unavailable:', (error as Error).message);
    }
    return false;
  }
  for (const [name, bytes] of files) eph.mount(name, bytes);
  eph.set_ephe_path('.');
  return true;
}
