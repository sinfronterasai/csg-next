import { buildVerifiedFactsV2 } from '@/lib/reportFacts/build';
import { buildAspects, buildCommonDerived, buildPatterns, EXACT_ASPECT_EPSILON, round2 } from '@/lib/reportFacts/derived';
import { preflightReport, validateFactResolution } from '@/lib/reportFacts/schemas';
import { computeChart, normDeg } from '@/lib/chartEngine';
import { angularDistance } from '@/lib/transit';
import { ALL_FIXTURES, KNOWN_TIME_ORDINARY, UNKNOWN_TIME_SOLAR } from './fixtures/factsFixtures';

function bodyList(xs:{key:string;longitude:number}[]):any { return xs.map(x=>({id:`natal.${x.key}.position`,key:x.key,label:x.key,longitude:x.longitude,full:x})); }
const sign=(d:number)=>['aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces'][Math.floor(normDeg(d)/30)];
function pattern(order:{key:string;longitude:number}[],name:'Yod'|'TSquare'){
  const planets=order.map(x=>({key:x.key,label:x.key,longitude:x.longitude,degreeInSign:normDeg(x.longitude)%30,sign:sign(x.longitude),house:1,retrograde:false}));
  const chart:any={planets};
  const aspects=buildAspects(bodyList(order));
  return buildPatterns(chart,aspects,new Set(planets.map(p=>`natal.${p.key}.position`))).find((p:any)=>p.value.name===name)!;
}
function perms<T>(a:T[]):T[][]{return a.length<2?[a]:a.flatMap((x,i)=>perms([...a.slice(0,i),...a.slice(i+1)]).map(p=>[x,...p]));}

describe('fifth independent review adversarial cases',()=>{
  test('Love Blueprint named fields reject a nonempty but wrong pair',async()=>{
    const v=await buildVerifiedFactsV2('loveblueprint',KNOWN_TIME_ORDINARY.birth);
    (v.reportData as any).loveBlueprintEvidence.aspects.moonVenus.pair='sun-pluto';
    expect(preflightReport('loveblueprint',v).status).toBe('input_incomplete');
  });

  test('Vocation named MC fields reject a wrong pair before the window gate',async()=>{
    const v=await buildVerifiedFactsV2('vocation',KNOWN_TIME_ORDINARY.birth);
    (v.reportData as any).vocationEvidence.saturnAspect.pair='saturn-sun';
    const r=preflightReport('vocation',v);
    expect(r.missing.some(x=>x.includes('saturnAspect'))).toBe(true);
  });

  test('nodal and Chiron arrays reject real aspects with wrong semantic endpoints',async()=>{
    const v=await buildVerifiedFactsV2('karmicshadow',KNOWN_TIME_ORDINARY.birth);
    const unrelated=v.common.aspects.find(a=>!a.value.bodyA.includes('node')&&!a.value.bodyB.includes('node')&&a.value.bodyA!=='chiron'&&a.value.bodyB!=='chiron')!;
    const e:any=(v.reportData as any).karmicEvidence;
    e.nodalAspects=[unrelated.id];
    e.chironAspects=[unrelated.id];
    e.chironEvidence={present:true,ids:[unrelated.id]};
    expect(preflightReport('karmicshadow',v).status).toBe('input_incomplete');
    expect(validateFactResolution(v).ok).toBe(false);
  });

  test('optional Chiron state enforces present/ids/reason consistency',async()=>{
    const v=await buildVerifiedFactsV2('karmicshadow',KNOWN_TIME_ORDINARY.birth);
    const e:any=(v.reportData as any).karmicEvidence;
    e.chironEvidence={present:false,ids:e.chironAspects,reason:undefined};
    expect(preflightReport('karmicshadow',v).status).toBe('input_incomplete');
  });

  test('Love Blueprint exposes explicit Chiron present-or-absent state',async()=>{
    const v=await buildVerifiedFactsV2('loveblueprint',KNOWN_TIME_ORDINARY.birth);
    const e:any=(v.reportData as any).loveBlueprintEvidence;
    expect(e.chironEvidence).toBeDefined();
    expect(typeof e.chironEvidence.present).toBe('boolean');
  });

  test('RulerFact structured fields are actually schema-validated',async()=>{
    const v=await buildVerifiedFactsV2('relationship',KNOWN_TIME_ORDINARY.birth);
    (v.reportData as any).relationshipEvidence.seventhHouseRuler.degreeInSign=undefined;
    (v.reportData as any).relationshipEvidence.seventhHouseRuler.retrograde='no';
    expect(preflightReport('relationship',v).status).toBe('input_incomplete');
  });

  test('Part-of-Fortune sect/formula metadata is schema-validated',async()=>{
    const v=await buildVerifiedFactsV2('natal',KNOWN_TIME_ORDINARY.birth);
    (v.common.partOfFortune!.value as any).sect='twilight';
    (v.common.partOfFortune!.value as any).formula='';
    expect(preflightReport('natal',v).status).toBe('input_incomplete');
  });

  test('evidence provenance must correspond to its real aspectId',async()=>{
    let exercised=false;
    for(const f of ALL_FIXTURES.filter(x=>x.expect.knownTime)){
      const v=await buildVerifiedFactsV2('relationship',f.birth);
      const aspects:any=(v.reportData as any).relationshipEvidence.aspects;
      const e:any=Object.values(aspects).find((x:any)=>x.aspectId!==null);
      if(!e) continue;
      exercised=true;
      e.provenance=['natal.sun.position']; // real fact, but not the cited aspect
      expect(preflightReport('relationship',v).status).toBe('input_incomplete');
      break;
    }
    expect(exercised).toBe(true);
  });

  test('pattern serialization, not only ID, is invariant across all participant orders',()=>{
    const base=[{key:'sun',longitude:210},{key:'venus',longitude:0},{key:'mars',longitude:60}];
    const normalized=perms(base).map(p=>{
      const x:any=pattern(p,'Yod');
      return JSON.stringify({id:x.id,display:x.display,value:x.value,provenance:[...x.provenance].sort()});
    });
    expect(new Set(normalized).size).toBe(1);
  });

  test('aspect identity is invariant when endpoint input order reverses',()=>{
    const a=buildAspects(bodyList([{key:'sun',longitude:0},{key:'jupiter',longitude:9}])).find(x=>x.value.aspectType==='conjunction')!;
    const b=buildAspects(bodyList([{key:'jupiter',longitude:9},{key:'sun',longitude:0}])).find(x=>x.value.aspectType==='conjunction')!;
    expect(a.id).toBe(b.id);
    expect(a.provenance).toEqual(b.provenance);
    expect(a.value).toEqual(b.value);
  });

  test('tight threshold uses full-precision error before display rounding',()=>{
    const a=buildAspects(bodyList([{key:'sun',longitude:0},{key:'jupiter',longitude:0.999}])).find(x=>x.value.aspectType==='conjunction')!;
    expect(a.value.orb).toBe(1);
    expect(a.value.tight).toBe(true);
    expect(a.value.exact).toBe(0.999<EXACT_ASPECT_EPSILON);
  });

  test('POF aspect orbs derive from the full-precision point on every known-time fixture',async()=>{
    let checked=0;
    for(const f of ALL_FIXTURES.filter(x=>x.expect.knownTime)){
      const chart=await computeChart(f.birth as any);
      const common=await buildCommonDerived(chart,false);
      const isDay=chart.sun.house!==null&&chart.sun.house>=7&&chart.sun.house<=12;
      const pof=normDeg(chart.ascendant.longitude+(isDay?chart.moon.longitude-chart.sun.longitude:chart.sun.longitude-chart.moon.longitude));
      for(const a of common.aspects.filter(x=>x.value.bodyA==='partoffortune'||x.value.bodyB==='partoffortune')){
        const other=a.value.bodyA==='partoffortune'?a.value.bodyB:a.value.bodyA;
        let otherLong=chart.planets.find(p=>p.key===other)?.longitude;
        if(other==='ascendant') otherLong=chart.ascendant.longitude;
        if(other==='descendant') otherLong=normDeg(chart.ascendant.longitude+180);
        if(other==='midheaven') otherLong=chart.midheaven.longitude;
        if(other==='icumcoeli') otherLong=normDeg(chart.midheaven.longitude+180);
        if(other==='southnode') otherLong=normDeg(chart.planets.find(p=>p.key==='northnode')!.longitude+180);
        if(otherLong===undefined) continue;
        const def:any={conjunction:0,'semi-sextile':30,'semi-square':45,sextile:60,square:90,trine:120,sesquisquare:135,quincunx:150,opposition:180};
        const expected=round2(Math.abs(angularDistance(pof,otherLong)-def[a.value.aspectType]));
        expect(a.value.orb).toBe(expected);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  test('unknown-time fixture is a verified Moon sign-change date, not a conditional pass',async()=>{
    const start=await computeChart({...UNKNOWN_TIME_SOLAR.birth,time:'00:00',unknownTime:false} as any);
    const end=await computeChart({...UNKNOWN_TIME_SOLAR.birth,time:'23:59',unknownTime:false} as any);
    expect(start.moon.sign).not.toBe(end.moon.sign);
    const v=await buildVerifiedFactsV2('natal',UNKNOWN_TIME_SOLAR.birth);
    expect(v.common.solarSign?.moon).toBeUndefined();
  });

  test('Vocation emits MC sign/degree and the complete cited set of MC aspects',async()=>{
    const v=await buildVerifiedFactsV2('vocation',KNOWN_TIME_ORDINARY.birth);
    const e:any=(v.reportData as any).vocationEvidence;
    const expected=v.common.aspects.filter(a=>a.value.bodyA==='midheaven'||a.value.bodyB==='midheaven').map(a=>a.id).sort();
    expect(e.mcPositionId).toBe('natal.midheaven.position');
    expect(e.mcSign).toBe((v.facts['natal.midheaven.position'].value as any).sign);
    expect(e.mcDegreeInSign).toBe((v.facts['natal.midheaven.position'].value as any).degreeInSign);
    expect([...e.mcAspects].sort()).toEqual(expected);
  });

  test('report-specific Chiron evidence contains only the promised counterpart bodies',async()=>{
    const k=await buildVerifiedFactsV2('karmicshadow',KNOWN_TIME_ORDINARY.birth);
    const ke:any=(k.reportData as any).karmicEvidence;
    for(const id of ke.chironAspects){
      const a:any=k.facts[id].value;
      expect([a.bodyA,a.bodyB]).toContain('chiron');
      expect([a.bodyA,a.bodyB].some((b:string)=>b.includes('node'))).toBe(true);
    }
    const l=await buildVerifiedFactsV2('loveblueprint',KNOWN_TIME_ORDINARY.birth);
    const le:any=(l.reportData as any).loveBlueprintEvidence;
    for(const id of le.chironAspects){
      const a:any=l.facts[id].value;
      expect([a.bodyA,a.bodyB]).toContain('chiron');
      expect([a.bodyA,a.bodyB].some((b:string)=>b==='venus'||b==='moon')).toBe(true);
    }
  });
});
