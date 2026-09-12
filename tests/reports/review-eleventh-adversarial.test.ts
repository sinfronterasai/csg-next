import { buildVerifiedFactsV2 } from '@/lib/reportFacts/build';
import { preflightReport } from '@/lib/reportFacts/schemas';
import { KNOWN_TIME_ORDINARY } from './fixtures/factsFixtures';

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

describe('eleventh independent adversarial probes', () => {
  test('canonical/common aspect nested unexpected metadata fails closed', async () => {
    const v: any = clone(await buildVerifiedFactsV2('natal', KNOWN_TIME_ORDINARY.birth));
    const common = v.common.aspects[0];
    const canonical = v.facts[common.id];
    common.value.injected = 'not contract data';
    canonical.value.injected = 'not contract data';
    expect(preflightReport('natal', v).status).toBe('input_incomplete');
  });

  test('canonical aspect facts-map key must equal wrapper id', async () => {
    const v: any = clone(await buildVerifiedFactsV2('natal', KNOWN_TIME_ORDINARY.birth));
    const common = v.common.aspects[0];
    const canonical = v.facts[common.id];
    delete v.facts[common.id];
    v.facts['natal.aspect.false-map-key'] = canonical;
    expect(preflightReport('natal', v).status).toBe('input_incomplete');
  });

  test('coordinated reversed aspect endpoints are not canonical', async () => {
    const v: any = clone(await buildVerifiedFactsV2('natal', KNOWN_TIME_ORDINARY.birth));
    const common = v.common.aspects[0];
    const canonical = v.facts[common.id];
    for (const a of [common, canonical]) {
      [a.value.bodyA, a.value.bodyB] = [a.value.bodyB, a.value.bodyA];
      [a.value.bodyALabel, a.value.bodyBLabel] = [a.value.bodyBLabel, a.value.bodyALabel];
      a.provenance.reverse();
      a.display = `${a.value.bodyALabel} ${a.value.aspectType} ${a.value.bodyBLabel} (orb ${a.value.orb}°)`;
    }
    expect(preflightReport('natal', v).status).toBe('input_incomplete');
  });

  test('coordinated non-finite aspect orb and weight fail closed', async () => {
    const v: any = clone(await buildVerifiedFactsV2('natal', KNOWN_TIME_ORDINARY.birth));
    const common = v.common.aspects[0];
    const canonical = v.facts[common.id];
    for (const a of [common, canonical]) {
      a.value.orb = Number.NaN;
      a.value.weight = Number.NaN;
      a.display = `${a.value.bodyALabel} ${a.value.aspectType} ${a.value.bodyBLabel} (orb NaN°)`;
    }
    expect(preflightReport('natal', v).status).toBe('input_incomplete');
  });

  test('both POF copies cannot coordinate a false signLabel', async () => {
    const v: any = clone(await buildVerifiedFactsV2('natal', KNOWN_TIME_ORDINARY.birth));
    v.common.partOfFortune.value.signLabel = 'False Sign';
    v.facts['natal.partoffortune.position'].value.signLabel = 'False Sign';
    expect(preflightReport('natal', v).status).toBe('input_incomplete');
  });

  test('both POF copies require signLabel rather than accepting coordinated omission', async () => {
    const v: any = clone(await buildVerifiedFactsV2('natal', KNOWN_TIME_ORDINARY.birth));
    delete v.common.partOfFortune.value.signLabel;
    delete v.facts['natal.partoffortune.position'].value.signLabel;
    expect(preflightReport('natal', v).status).toBe('input_incomplete');
  });

  test('both POF copies cannot coordinate false key and label', async () => {
    const v: any = clone(await buildVerifiedFactsV2('natal', KNOWN_TIME_ORDINARY.birth));
    for (const w of [v.common.partOfFortune, v.facts['natal.partoffortune.position']]) {
      w.value.key = 'falsefortune';
      w.value.label = 'False Fortune';
    }
    expect(preflightReport('natal', v).status).toBe('input_incomplete');
  });
});
