import * as fs from 'fs';
import * as path from 'path';
import { buildVerifiedFactsV2 } from '@/lib/reportFacts/build';
import { preflightReport } from '@/lib/reportFacts/schemas';
import { KNOWN_TIME_ORDINARY } from './fixtures/factsFixtures';
import { QUERY_LOG, SOURCE_METADATA } from './fixtures/independentReferenceCorpus';

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const result = (rt: any, v: any) => preflightReport(rt, v);

describe('ninth independent review — fresh semantic and corpus integrity cases', () => {
  test('common position alias display must equal its canonical fact display', async () => {
    const v: any = clone(await buildVerifiedFactsV2('natal', KNOWN_TIME_ORDINARY.birth));
    v.common.juno.display = 'False display with otherwise valid fields';
    expect(result('natal', v).status).toBe('input_incomplete');
  });

  test('both POF wrappers require canonical source and display semantics', async () => {
    const v: any = clone(await buildVerifiedFactsV2('natal', KNOWN_TIME_ORDINARY.birth));
    v.common.partOfFortune.source = 'swiss-ephemeris';
    v.common.partOfFortune.display = 'False POF display';
    expect(result('natal', v).status).toBe('input_incomplete');
  });

  test('cusp wrapper source and provenance must be canonical, not merely typed', async () => {
    const v: any = clone(await buildVerifiedFactsV2('relationship', KNOWN_TIME_ORDINARY.birth));
    v.facts['common.cusp.7'].source = 'swiss-ephemeris';
    v.facts['common.cusp.7'].provenance = ['natal.venus.position'];
    expect(result('relationship', v).status).toBe('input_incomplete');
  });

  test('common aspect serialization requires exact provenance order', async () => {
    const v: any = clone(await buildVerifiedFactsV2('natal', KNOWN_TIME_ORDINARY.birth));
    expect(v.common.aspects[0].provenance.length).toBe(2);
    v.common.aspects[0].provenance.reverse();
    expect(result('natal', v).status).toBe('input_incomplete');
  });

  test('coordinated canonical/common aspect source corruption fails closed', async () => {
    const v: any = clone(await buildVerifiedFactsV2('natal', KNOWN_TIME_ORDINARY.birth));
    const a = v.common.aspects[0];
    a.source = 'swiss-ephemeris';
    v.facts[a.id].source = 'swiss-ephemeris';
    expect(result('natal', v).status).toBe('input_incomplete');
  });

  test('root position wrapper source/provenance semantics are validated', async () => {
    const v: any = clone(await buildVerifiedFactsV2('natal', KNOWN_TIME_ORDINARY.birth));
    v.facts['natal.sun.position'].source = 'derived-deterministic';
    v.facts['natal.sun.position'].provenance = ['natal.venus.position'];
    expect(result('natal', v).status).toBe('input_incomplete');
  });

  test('missing node context returns incomplete instead of throwing', async () => {
    const v: any = clone(await buildVerifiedFactsV2('karmicshadow', KNOWN_TIME_ORDINARY.birth));
    delete v.facts['natal.northnode.position'];
    expect(() => result('karmicshadow', v)).not.toThrow();
    expect(result('karmicshadow', v).status).toBe('input_incomplete');
  });

  test('missing Vocation ruler returns incomplete instead of throwing', async () => {
    const v: any = clone(await buildVerifiedFactsV2('vocation', KNOWN_TIME_ORDINARY.birth));
    delete v.reportData.vocationEvidence.secondRuler;
    expect(() => result('vocation', v)).not.toThrow();
    const r = result('vocation', v);
    expect(r.status).toBe('input_incomplete');
    expect(r.missing.join(' | ')).toMatch(/secondRuler/);
  });

  test('external retrograde corpus covers every standard planet whose state is asserted', () => {
    const dir = path.join(__dirname, 'fixtures', 'jpl-raw');
    const names = new Set(fs.readdirSync(dir));
    for (const command of ['199', '299', '499', '599', '699', '799', '899', '999']) {
      expect(names.has(`planet_${command}_retro.json`)).toBe(true);
    }
  });

  test('corpus records exact reproducible queries and a retrieval date', () => {
    expect(SOURCE_METADATA.retrieved).toMatch(/^\d{4}-\d{2}-\d{2}/);
    for (const q of Object.values(QUERY_LOG)) {
      expect(q).toContain('https://ssd.jpl.nasa.gov/api/horizons.api?');
      expect(q).toContain('MAKE_EPHEM');
      expect(q).toContain('STEP_SIZE');
      expect(q).toContain('CSV_FORMAT');
    }
  });

  test('external corpus includes fixed external angle and selected-node results', () => {
    const dir = path.join(__dirname, 'fixtures', 'jpl-raw');
    const raw = fs.readdirSync(dir).map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n').toLowerCase();
    expect(raw).toMatch(/ascendant/);
    expect(raw).toMatch(/midheaven/);
    expect(raw).toMatch(/node/);
  });
});
