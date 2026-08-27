import { buildVerifiedFactsV2 } from '@/lib/reportFacts/build';
import { preflightReport } from '@/lib/reportFacts/schemas';
import { buildCommonDerived, mechanicalJplTimestamps, round2, POSITION_REGISTRY } from '@/lib/reportFacts/derived';
import { computeChart, houseForLongitude } from '@/lib/chartEngine';
import { signFromLongitude, dignityFor } from '@/lib/astrology';
import { angularDistance } from '@/lib/transit';
import { ALL_FIXTURES, UNKNOWN_TIME_SOLAR } from './fixtures/factsFixtures';

const clone=<T>(x:T):T=>JSON.parse(JSON.stringify(x));
const ordinal=(n:number)=>{const s=['th','st','nd','rd'],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0]);};
const DIGNITY_LABEL:Record<string,string>={domicile:'in domicile',exaltation:'exalted',detriment:'in detriment',fall:'in fall'};
const display=(v:any)=>{const {sign,degreeInSign}=signFromLongitude(v.longitude);const h=v.house!=null?` in the ${ordinal(v.house)} house`:'';const d=v.dignity?`, ${DIGNITY_LABEL[v.dignity as string]}`:'';const r=v.retrograde?' (retrograde)':'';const u=v.uncertain?' (approximate; birth time unknown)':'';return `${v.label} at ${degreeInSign.toFixed(2)}° ${sign.label}${h}${d}${r}${u}`;};

describe('fifteenth independent semantic probes',()=>{
  test.each([
    ['2025-02-30 09:00','2025-02-30 10:00'],
    ['1990-13-15 09:00','1990-13-15 10:00'],
    ['1990-06-15 25:00','1990-06-15 26:00'],
    ['1990-06-15 09:60','1990-06-15 10:60'],
  ])('mechanical JPL timestamps reject impossible calendar/time values %s', (start,stop)=>{
    expect(()=>mechanicalJplTimestamps(start,stop,'1 h')).toThrow();
  });

  test('unknown-time baseline and fabricated-house mutation are distinguished',async()=>{
    const v:any=clone(await buildVerifiedFactsV2('natal',UNKNOWN_TIME_SOLAR.birth));
    const baseline=preflightReport('natal',v).status;
    const f=v.facts['natal.mercury.position'];
    expect(f.value.house).toBeNull();
    expect(f.value.uncertain).toBe(true);
    f.value.house=5;
    f.display=display(f.value);
    const mutated=preflightReport('natal',v).status;
    if(baseline==='complete') expect(mutated).toBe('input_incomplete');
    else expect(baseline).toBe('input_incomplete');
  });

  test('independent POF aspect check has per-fixture non-vacuous coverage',async()=>{
    for(const fixture of ALL_FIXTURES.filter(x=>x.expect.knownTime)){
      const chart=await computeChart(fixture.birth as any);
      const common=await buildCommonDerived(chart,false);
      const hits=common.aspects.filter(x=>x.value.bodyA==='partoffortune'||x.value.bodyB==='partoffortune');
      expect(hits.length).toBeGreaterThan(0);
    }
  });

  test('inclusive singleton JPL window produces its one endpoint',()=>{
    expect(mechanicalJplTimestamps('1990-06-15 09:00','1990-06-15 09:00','1 h')).toEqual(['1990-Jun-15 09:00']);
  });

  test('raw common.houses order cannot redefine every published house',async()=>{
    const v:any=clone(await buildVerifiedFactsV2('natal',ALL_FIXTURES.find(x=>x.name==='known-ordinary')!.birth));
    [v.common.houses[10],v.common.houses[11]]=[v.common.houses[11],v.common.houses[10]];
    const cusps=[0,...v.common.houses.map((h:any)=>h.cuspLongitude)];
    for(const e of POSITION_REGISTRY){
      const f:any=v.facts[e.factsKey];
      if(!f) continue;
      if(e.nestedKey==='ascendant') f.value.house=1;
      else if(e.nestedKey==='midheaven') f.value.house=10;
      else if(e.nestedKey==='descendant') f.value.house=7;
      else if(e.nestedKey==='icumcoeli') f.value.house=4;
      else f.value.house=houseForLongitude(f.value.longitude,cusps);
      f.display=display(f.value);
    }
    for(const p of v.common.positions){
      const f:any=v.facts[`natal.${p.value.key}.position`];
      if(f){p.value=clone(f.value);p.display=f.display;}
    }
    const aliases:[string,string][]=[['ascendant','ascendant'],['descendant','descendant'],['midheaven','midheaven'],['icumcoeli','icumcoeli'],['northNode','northnode'],['southNode','southnode'],['juno','juno']];
    for(const [alias,key] of aliases){const f:any=v.facts[`natal.${key}.position`];v.common[alias]={...clone(f.value),display:f.display};}
    const pf:any=v.facts['natal.partoffortune.position'];
    v.common.partOfFortune={...clone(pf),value:clone(pf.value),display:pf.display};
    const result=preflightReport('natal',v);
    expect(result.status).toBe('input_incomplete');
  });
});
