import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { buildVerifiedFactsV2 } from '@/lib/reportFacts/build';
import { preflightReport } from '@/lib/reportFacts/schemas';
import { KNOWN_TIME_ORDINARY } from './fixtures/factsFixtures';
import { QUERY_LOG, EXTERNAL_CHART_REQUEST, FIXED_EXPECTED, JPL_MANIFEST } from './fixtures/independentReferenceCorpus';

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const run = (rt: any, v: any) => preflightReport(rt, v);

describe('tenth independent review — fresh semantic and corpus-integrity cases', () => {
  // Every QUERY_LOG window must equal the window in its own committed raw artifact header.
  // The artifact is read here independently of the manifest, so a drifting constant fails.
  test('every JPL query window equals its committed raw artifact header window', () => {
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    // '1990-Jun-15 09:00' (header) -> '1990-06-15 09:00' (query form of the SAME instant)
    const fromHeader = (h: string): string => {
      const m = /(\d{4})-([A-Z][a-z]{2})-(\d{2}) (\d{2}:\d{2})/.exec(h);
      if (!m) throw new Error(`unparseable header window: ${h}`);
      return `${m[1]}-${String(MONTHS.indexOf(m[2]) + 1).padStart(2, '0')}-${m[3]} ${m[4]}`;
    };
    const header = (result: string, label: string): string => {
      const line = result.split('\n').find((l: string) => l.startsWith(label));
      if (!line) throw new Error(`header ${label} missing`);
      return line.slice(line.indexOf(':') + 1).trim();
    };
    expect(JPL_MANIFEST.length).toBe(14);
    for (const row of JPL_MANIFEST) {
      const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'jpl-raw', row.file), 'utf8'));
      const artStart = fromHeader(header(raw.result, 'Start time'));
      const artStop = fromHeader(header(raw.result, 'Stop  time'));
      const dec = decodeURIComponent(QUERY_LOG[row.queryKey].replace(/\+/g, ' '));
      expect(dec).toContain(`START_TIME='${artStart}'`);
      expect(dec).toContain(`STOP_TIME='${artStop}'`);
      const rows = raw.result.split('\n').filter((l: string) => /\d{4}-[A-Z][a-z]{2}-\d{2} \d{2}:\d{2},/.test(l));
      expect(rows.length).toBe(row.expRows);
    }
    // the distinct boundary/outer windows really are distinct from the ordinary Paris query
    expect(QUERY_LOG.moon_solar_start).not.toBe(QUERY_LOG.moon_paris_1990_06_15T10);
    expect(QUERY_LOG.moon_solar_end).not.toBe(QUERY_LOG.moon_paris_1990_06_15T10);
    expect(QUERY_LOG.moon_invariant_start).not.toBe(QUERY_LOG.moon_paris_1990_06_15T10);
    expect(QUERY_LOG.moon_invariant_end).not.toBe(QUERY_LOG.moon_paris_1990_06_15T10);
    expect(QUERY_LOG.planet_599_retro).not.toBe(QUERY_LOG.planet_199_retro);
  });

  test('CosmyDay manifest SHA is recomputed from exact committed response bytes', () => {
    const raw = fs.readFileSync(path.join(__dirname, 'fixtures', 'jpl-raw', 'cosmyday-paris-1990-06-15T12-local.json'));
    expect(createHash('sha256').update(raw).digest('hex')).toBe(EXTERNAL_CHART_REQUEST.responseSha256);
  });

  test('fixed MC sign agrees with its own external longitude', () => {
    const signs = ['aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces'];
    expect(FIXED_EXPECTED.midheaven.sign).toBe(signs[Math.floor(FIXED_EXPECTED.midheaven.longitude / 30)]);
  });

  test('flat POF wrapper requires exact canonical id', async () => {
    const v: any = clone(await buildVerifiedFactsV2('natal', KNOWN_TIME_ORDINARY.birth));
    v.facts['natal.partoffortune.position'].id = 'natal.false.position';
    expect(run('natal', v).status).toBe('input_incomplete');
  });

  test('common POF wrapper rejects unexpected wrapper metadata', async () => {
    const v: any = clone(await buildVerifiedFactsV2('natal', KNOWN_TIME_ORDINARY.birth));
    v.common.partOfFortune.injected = 'not contract data';
    expect(run('natal', v).status).toBe('input_incomplete');
  });

  test('flat POF wrapper rejects unexpected wrapper metadata', async () => {
    const v: any = clone(await buildVerifiedFactsV2('natal', KNOWN_TIME_ORDINARY.birth));
    v.facts['natal.partoffortune.position'].injected = 'not contract data';
    expect(run('natal', v).status).toBe('input_incomplete');
  });

  test('coordinated false POF displays cannot establish deterministic truth', async () => {
    const v: any = clone(await buildVerifiedFactsV2('natal', KNOWN_TIME_ORDINARY.birth));
    v.common.partOfFortune.display = 'Coordinated but false POF display';
    v.facts['natal.partoffortune.position'].display = 'Coordinated but false POF display';
    expect(run('natal', v).status).toBe('input_incomplete');
  });

  test('cusp display is canonical and cannot be independently corrupted', async () => {
    const v: any = clone(await buildVerifiedFactsV2('relationship', KNOWN_TIME_ORDINARY.birth));
    v.facts['common.cusp.7'].display = 'False cusp display';
    expect(run('relationship', v).status).toBe('input_incomplete');
  });

  test('coordinated common/canonical aspect id corruption cannot establish authority', async () => {
    const v: any = clone(await buildVerifiedFactsV2('natal', KNOWN_TIME_ORDINARY.birth));
    const original = v.common.aspects[0];
    const oldId = original.id;
    const falseId = 'natal.aspect.false-but-coordinated';
    original.id = falseId;
    v.facts[oldId].id = falseId;
    expect(run('natal', v).status).toBe('input_incomplete');
  });

  test('coordinated common/canonical invalid aspect type cannot establish authority', async () => {
    const v: any = clone(await buildVerifiedFactsV2('natal', KNOWN_TIME_ORDINARY.birth));
    const a = v.common.aspects[0];
    a.value.aspectType = 'invented-aspect';
    v.facts[a.id].value.aspectType = 'invented-aspect';
    expect(run('natal', v).status).toBe('input_incomplete');
  });

  test('malformed ruler provenance fails closed without throwing', async () => {
    const v: any = clone(await buildVerifiedFactsV2('relationship', KNOWN_TIME_ORDINARY.birth));
    delete v.reportData.relationshipEvidence.seventhHouseRuler.provenance;
    expect(() => run('relationship', v)).not.toThrow();
    expect(run('relationship', v).status).toBe('input_incomplete');
  });

  test('null node context value fails closed without throwing', async () => {
    const v: any = clone(await buildVerifiedFactsV2('karmicshadow', KNOWN_TIME_ORDINARY.birth));
    v.facts['natal.northnode.position'].value = null;
    expect(() => run('karmicshadow', v)).not.toThrow();
    expect(run('karmicshadow', v).status).toBe('input_incomplete');
  });

  test('non-array common aspects fails closed without throwing', async () => {
    const v: any = clone(await buildVerifiedFactsV2('natal', KNOWN_TIME_ORDINARY.birth));
    v.common.aspects = { malformed: true };
    expect(() => run('natal', v)).not.toThrow();
    expect(run('natal', v).status).toBe('input_incomplete');
  });
});
