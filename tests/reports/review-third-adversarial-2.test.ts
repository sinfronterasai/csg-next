import { buildVerifiedFactsV2 } from '@/lib/reportFacts/build';
import { preflightReport, validateFactResolution } from '@/lib/reportFacts/schemas';
import { computeVerifiedCommon } from '@/lib/reportFacts/derived';
import { KNOWN_TIME_ORDINARY, ALL_FIXTURES } from './fixtures/factsFixtures';

const norm=(x:number)=>((x%360)+360)%360;

describe('independent third review adversarial contract cases 2',()=>{
  test('aspect grid is globally strongest-first by ascending orb',async()=>{
    const v=await buildVerifiedFactsV2('natal',KNOWN_TIME_ORDINARY.birth);
    const orbs=v.common.aspects.map(a=>a.value.orb);
    expect(orbs).toEqual([...orbs].sort((a,b)=>a-b));
  });

  test('nested evidence aspect ids/provenance must resolve',async()=>{
    const v=await buildVerifiedFactsV2('relationship',KNOWN_TIME_ORDINARY.birth);
    const e:any=(v.reportData as any).relationshipEvidence.aspects.venusMars;
    e.aspectId='natal.aspect.fake';
    e.provenance=['natal.aspect.fake'];
    expect(preflightReport('relationship',v).status).toBe('input_incomplete');
    expect(validateFactResolution(v).ok).toBe(false);
  });

  test('relationship scoreDrivers cannot contain dangling fact ids',async()=>{
    const v=await buildVerifiedFactsV2('relationship',KNOWN_TIME_ORDINARY.birth);
    (v.reportData as any).relationshipEvidence.scoreDrivers=['score.relationship.fake'];
    expect(preflightReport('relationship',v).status).toBe('input_incomplete');
    expect(validateFactResolution(v).ok).toBe(false);
  });

  test('vocation fails closed until exact 24-month career windows exist',async()=>{
    const v=await buildVerifiedFactsV2('vocation',KNOWN_TIME_ORDINARY.birth);
    expect((v.reportData as any).vocationEvidence.careerWindowsDeclared).toBe(false);
    expect(preflightReport('vocation',v).status).toBe('input_incomplete');
  });

  test('Part of Fortune switches day/night formula based on solar sect',async()=>{
    let checkedNight=0;
    for(const f of ALL_FIXTURES.filter(x=>x.expect.knownTime)){
      const c=await computeVerifiedCommon(f.birth);
      const sun:any=c.positions.find((p:any)=>p.id==='natal.sun.position')!.value;
      const moon:any=c.positions.find((p:any)=>p.id==='natal.moon.position')!.value;
      const asc:any=c.positions.find((p:any)=>p.id==='natal.ascendant.position')!.value;
      const pof:any=c.partOfFortune!.value;
      const isDay=sun.house>=7 && sun.house<=12;
      const expected=norm(isDay ? asc.longitude+moon.longitude-sun.longitude : asc.longitude+sun.longitude-moon.longitude);
      if(!isDay) checkedNight++;
      expect(pof.longitude).toBeCloseTo(expected,1);
    }
    expect(checkedNight).toBeGreaterThan(0);
  });
});
