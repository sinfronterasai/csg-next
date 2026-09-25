import { buildVerifiedFactsV2 } from '@/lib/reportFacts/build';
import { preflightReport } from '@/lib/reportFacts/schemas';
import { KNOWN_TIME_ORDINARY } from './fixtures/factsFixtures';

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const DETERMINISTIC_BIRTH = {
  ...KNOWN_TIME_ORDINARY.birth,
  latitude: 40.7128,
  longitude: -74.006,
  timezone: 'America/New_York',
};
let natalFacts: any;

describe('twelfth independent adversarial probes', () => {
  beforeAll(async () => {
    natalFacts = await buildVerifiedFactsV2('natal', DETERMINISTIC_BIRTH);
  }, 30000);
  test('common position alias must exactly equal canonical longitude and degree', async () => {
    const v: any = clone(natalFacts);
    v.common.ascendant.longitude += 0.0005;
    v.common.ascendant.degreeInSign += 0.0005;
    expect(preflightReport('natal', v).status).toBe('input_incomplete');
  });

  test('root position wrapper id must equal its facts-map key', async () => {
    const v: any = clone(natalFacts);
    v.facts['natal.ascendant.position'].id = 'natal.false.position';
    expect(preflightReport('natal', v).status).toBe('input_incomplete');
  });

  test('root position wrapper rejects unexpected metadata', async () => {
    const v: any = clone(natalFacts);
    v.facts['natal.ascendant.position'].injected = 'not contract data';
    expect(preflightReport('natal', v).status).toBe('input_incomplete');
  });

  test('root position value rejects unexpected metadata', async () => {
    const v: any = clone(natalFacts);
    v.facts['natal.ascendant.position'].value.injected = 'not contract data';
    expect(preflightReport('natal', v).status).toBe('input_incomplete');
  });

  test('ordinary planet wrapper rejects unexpected metadata', async () => {
    const v: any = clone(natalFacts);
    v.facts['natal.sun.position'].injected = 'not contract data';
    expect(preflightReport('natal', v).status).toBe('input_incomplete');
  });

  test('ordinary planet value rejects unexpected metadata', async () => {
    const v: any = clone(natalFacts);
    v.facts['natal.sun.position'].value.injected = 'not contract data';
    expect(preflightReport('natal', v).status).toBe('input_incomplete');
  });

  test('ordinary planet wrapper display must be derived from its value', async () => {
    const v: any = clone(natalFacts);
    v.facts['natal.sun.position'].display = 'False coordinated position display';
    expect(preflightReport('natal', v).status).toBe('input_incomplete');
  });

  test('common aspects must preserve canonical deterministic array order', async () => {
    const v: any = clone(natalFacts);
    v.common.aspects.reverse();
    expect(preflightReport('natal', v).status).toBe('input_incomplete');
  });

  test('POF sect and formula are recomputed from canonical Sun house and inputs', async () => {
    const v: any = clone(natalFacts);
    for (const w of [v.common.partOfFortune, v.facts['natal.partoffortune.position']]) {
      w.value.sect = w.value.sect === 'day' ? 'night' : 'day';
      w.value.formula = w.value.sect === 'day' ? 'day:ASC+MOON-SUN' : 'night:ASC+SUN-MOON';
    }
    expect(preflightReport('natal', v).status).toBe('input_incomplete');
  });

  test('POF retrograde and dignity are locked deterministic semantics', async () => {
    const v: any = clone(natalFacts);
    for (const w of [v.common.partOfFortune, v.facts['natal.partoffortune.position']]) {
      w.value.retrograde = true;
      w.value.dignity = 'domicile';
    }
    expect(preflightReport('natal', v).status).toBe('input_incomplete');
  });
});
