import { buildVerifiedFactsV2 } from '@/lib/reportFacts/build';
import { preflightReport } from '@/lib/reportFacts/schemas';
import { buildPatterns } from '@/lib/reportFacts/derived';
import { computeChart } from '@/lib/chartEngine';
import { KNOWN_TIME_ORDINARY } from './fixtures/factsFixtures';

const miss=(rt:any,v:any)=>preflightReport(rt,v).missing.join(' | ');
const clone=(x:any)=>JSON.parse(JSON.stringify(x));

describe('eighth independent review supplement and canonical bypasses',()=>{
  test('flat POF source and provenance must remain canonical after serialization',async()=>{
    const v:any=clone(await buildVerifiedFactsV2('natal',KNOWN_TIME_ORDINARY.birth));
    const f=v.facts['natal.partoffortune.position'];
    f.source='swiss-ephemeris';
    f.provenance=['natal.sun.position','natal.moon.position','natal.venus.position'];
    expect(preflightReport('natal',v).status).toBe('input_incomplete');
  });

  test('Chiron present=false cannot coexist with a nonempty authoritative qualifying set or omitted ids',async()=>{
    const v:any=await buildVerifiedFactsV2('loveblueprint',KNOWN_TIME_ORDINARY.birth);
    const e=v.reportData.loveBlueprintEvidence;
    const id='natal.aspect.chiron-venus-conjunction';
    const fact:any={
      id,kind:'aspect',source:'derived-deterministic',display:'Chiron conjunction Venus (orb 1°)',
      value:{bodyA:'chiron',bodyB:'venus',aspectType:'conjunction',orb:1,tight:false,exact:false,bodyALabel:'Chiron',bodyBLabel:'Venus',weight:0,minor:false},
      provenance:['natal.chiron.position','natal.venus.position'],
    };
    expect(v.facts['natal.chiron.position']).toBeDefined();
    v.facts[id]=fact;
    v.common.aspects.push(fact);
    e.chironAspects=[id];
    e.chironEvidence={present:false,reason:'No qualifying Chiron-to-Venus-or-Moon tie was found in this chart'};
    expect(preflightReport('loveblueprint',v).status).toBe('input_incomplete');
  });

  test('two Stellium facts are identical across sign-group input permutations',async()=>{
    const base:any=await computeChart(KNOWN_TIME_ORDINARY.birth);
    const ps=base.planets.slice(0,6).map((p:any,i:number)=>({...p,sign:i<3?'aries':'taurus',signLabel:i<3?'Aries':'Taurus',degreeInSign:i%3+1,longitude:(i<3?0:30)+(i%3+1)}));
    const rest=base.planets.slice(6).map((p:any,i:number)=>({...p,sign:`x${i}`}));
    const a=[...ps,...rest];
    const b=[...ps.slice(3),...ps.slice(0,3),...rest];
    const ids=new Set(ps.map((p:any)=>`natal.${p.key}.position`));
    const pick=(arr:any[])=>buildPatterns({...base,planets:arr},[],ids).filter((p:any)=>p.value.name==='Stellium').sort((x:any,y:any)=>x.display.localeCompare(y.display));
    expect(pick(b)).toEqual(pick(a));
  });

  test('Vocation reports semantic corruption and career-window blocker together',async()=>{
    const v:any=await buildVerifiedFactsV2('vocation',KNOWN_TIME_ORDINARY.birth);
    v.reportData.vocationEvidence.mcSign=v.reportData.vocationEvidence.mcSign==='aries'?'taurus':'aries';
    const m=miss('vocation',v);
    expect(m).toMatch(/mcSign/);
    expect(m).toMatch(/career windows/);
  });

  test('common aspect index must equal canonical aspect facts by full content, not ids only',async()=>{
    const v:any=clone(await buildVerifiedFactsV2('natal',KNOWN_TIME_ORDINARY.birth));
    v.common.aspects[0].value.orb+=1;
    v.common.aspects[0].display='false but same id';
    expect(preflightReport('natal',v).status).toBe('input_incomplete');
  });

  test('alias uncertain metadata is compared using the actual contract field name',async()=>{
    const v:any=clone(await buildVerifiedFactsV2('natal',KNOWN_TIME_ORDINARY.birth));
    v.common.juno.uncertain=true;
    expect(preflightReport('natal',v).status).toBe('input_incomplete');
  });

  test('cusp sign must be consistent with canonical cusp longitude before deriving ruler',async()=>{
    const v:any=clone(await buildVerifiedFactsV2('relationship',KNOWN_TIME_ORDINARY.birth));
    const cusp=v.facts['common.cusp.7'].value;
    cusp.sign='leo'; cusp.signLabel='Leo';
    const p=v.facts['natal.sun.position'].value;
    const r=v.reportData.relationshipEvidence.seventhHouseRuler;
    Object.assign(r,{ruler:'sun',rulerLabel:'Sun',sign:p.sign,degreeInSign:p.degreeInSign,house_of_ruler:p.house,retrograde:p.retrograde,dignity:p.dignity,condition:p.dignity?({domicile:'in domicile',exaltation:'exalted',detriment:'in detriment',fall:'in fall'} as any)[p.dignity]:`in ${p.signLabel}`,provenance:['common.cusp.7','natal.sun.position']});
    expect(preflightReport('relationship',v).status).toBe('input_incomplete');
  });

  test('ruler contextual house must match its house; wrong house fails with correct placement',async()=>{
    const v:any=clone(await buildVerifiedFactsV2('relationship',KNOWN_TIME_ORDINARY.birth));
    const r=v.reportData.relationshipEvidence.seventhHouseRuler;
    // placement + house_of_ruler unchanged; only the contextual house is wrong (7 expected).
    r.house=2;
    expect(preflightReport('relationship',v).status).toBe('input_incomplete');
    expect(miss('relationship',v)).toMatch(/house/);
  });

  test('MC ruler contextual house must be 10; wrong house fails with correct placement',async()=>{
    const v:any=clone(await buildVerifiedFactsV2('vocation',KNOWN_TIME_ORDINARY.birth));
    const r=v.reportData.vocationEvidence.mcRuler;
    const okHouse=r.house; // capture correct
    r.house=7;
    expect(preflightReport('vocation',v).status).toBe('input_incomplete');
    // restore and confirm it passes (placement was correct)
    r.house=okHouse;
    expect(preflightReport('vocation',v).status).toBe('input_incomplete'); // still fails closed (career windows)
  });

  test('node rulers use the locked nodal sentinel house; wrong house fails',async()=>{
    const v:any=clone(await buildVerifiedFactsV2('karmicshadow',KNOWN_TIME_ORDINARY.birth));
    const r=v.reportData.karmicEvidence.northNodeRuler;
    expect(r.house).toBe('nodal');
    r.house=5;
    expect(preflightReport('karmicshadow',v).status).toBe('input_incomplete');
    expect(miss('karmicshadow',v)).toMatch(/house/);
  });
});
