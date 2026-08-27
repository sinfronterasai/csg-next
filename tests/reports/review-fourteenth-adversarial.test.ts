import { buildVerifiedFactsV2 } from '@/lib/reportFacts/build';
import { preflightReport } from '@/lib/reportFacts/schemas';
import { mechanicalJplTimestamps } from '@/lib/reportFacts/derived';
import { signFromLongitude } from '@/lib/astrology';
import { KNOWN_TIME_ORDINARY } from './fixtures/factsFixtures';

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const ordinal = (n: number) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
const display = (v: any) => {
  const { sign, degreeInSign } = signFromLongitude(v.longitude);
  const h = v.house != null ? ` in the ${ordinal(v.house)} house` : '';
  const d = v.dignity ? `, ${{ domicile: 'in domicile', exaltation: 'in exaltation', detriment: 'in detriment', fall: 'in fall' }[v.dignity as string]}` : '';
  const r = v.retrograde ? ' (retrograde)' : '';
  const u = v.uncertain ? ' (approximate; birth time unknown)' : '';
  return `${v.label} at ${degreeInSign.toFixed(2)}° ${sign.label}${h}${d}${r}${u}`;
};

describe('fourteenth independent semantic probes', () => {
  test('POF house is derived from recomputed longitude and validated cusps', async () => {
    const v: any = clone(await buildVerifiedFactsV2('natal', KNOWN_TIME_ORDINARY.birth));
    const f = v.facts['natal.partoffortune.position']; const a = v.common.partOfFortune;
    const wrong = f.value.house === 12 ? 11 : f.value.house + 1;
    f.value.house = wrong; a.value.house = wrong; f.display = display(f.value); a.display = f.display;
    expect(preflightReport('natal', v).status).toBe('input_incomplete');
  });

  test('ordinary root position house is derived from longitude and validated cusps', async () => {
    const v: any = clone(await buildVerifiedFactsV2('natal', KNOWN_TIME_ORDINARY.birth));
    const f = v.facts['natal.chiron.position'];
    f.value.house = f.value.house === 12 ? 11 : f.value.house + 1; f.display = display(f.value);
    expect(preflightReport('natal', v).status).toBe('input_incomplete');
  });

  test('mechanical JPL window rejects stop not aligned to declared step', () => {
    expect(() => mechanicalJplTimestamps('1990-06-15 09:00', '1990-06-15 10:30', '1 h')).toThrow();
  });
});
