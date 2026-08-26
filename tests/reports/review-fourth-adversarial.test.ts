import { buildVerifiedFactsV2 } from '@/lib/reportFacts/build';
import { ASPECT_ORBS, buildAspects, computeVerifiedCommon } from '@/lib/reportFacts/derived';
import { preflightReport, validateFactResolution } from '@/lib/reportFacts/schemas';
import { dignityFor } from '@/lib/astrology';
import { ALL_FIXTURES, BOUNDARY_NEAR_29, KNOWN_TIME_ORDINARY, UNKNOWN_TIME_SOLAR } from './fixtures/factsFixtures';

const norm = (x:number) => ((x % 360) + 360) % 360;
const dist = (a:number,b:number) => { const d=Math.abs(norm(a)-norm(b)); return Math.min(d,360-d); };
const dignityLabel:any={domicile:'in domicile',exaltation:'exalted',detriment:'in detriment',fall:'in fall'};
function bodies(xs:{key:string;longitude:number}[]):any {
  return xs.map(x=>({id:`natal.${x.key}.position`,key:x.key,label:x.key,longitude:x.longitude,full:x}));
}

describe('fourth independent review adversarial cases',()=>{
  test('nodal ruler condition and provenance use actual ruler planet placement',async()=>{
    const c=await computeVerifiedCommon(KNOWN_TIME_ORDINARY.birth);
    for(const nr of [c.nodalRulers!.north,c.nodalRulers!.south]){
      const p:any=c.positions.find((x:any)=>x.id===`natal.${nr.ruler}.position`)!.value;
      const d=dignityFor(nr.ruler,p.sign);
      expect(nr.sign).toBe(p.sign);
      expect(nr.condition).toBe(d ? dignityLabel[d] : `in ${p.signLabel}`);
      expect(nr.provenance).toContain(`natal.${nr.ruler}.position`);
    }
  });

  test('night Part-of-Fortune aspects use the same longitude as the emitted POF fact',async()=>{
    let checked=0;
    for(const f of ALL_FIXTURES.filter(x=>x.expect.knownTime)){
      const c=await computeVerifiedCommon(f.birth);
      const sun:any=c.positions.find((x:any)=>x.id==='natal.sun.position')!.value;
      if(sun.house>=7 && sun.house<=12) continue;
      const pof:any=c.partOfFortune!.value;
      for(const a of c.aspects.filter((x:any)=>x.value.bodyA==='partoffortune'||x.value.bodyB==='partoffortune')){
        const other=a.value.bodyA==='partoffortune'?a.value.bodyB:a.value.bodyA;
        const op:any=c.positions.find((x:any)=>(x.value as any).key===other)?.value;
        if(!op) continue;
        const def=ASPECT_ORBS.find(x=>x.type===a.value.aspectType)!;
        const error=Math.abs(dist(pof.longitude,op.longitude)-def.angle);
        expect(a.value.orb).toBeCloseTo(error,1);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  test('unknown-time ledger does not retain artificial-noon houses',async()=>{
    const c=await computeVerifiedCommon(UNKNOWN_TIME_SOLAR.birth);
    for(const p of c.positions) expect((p.value as any).house).toBeNull();
    expect(c.houses).toBeUndefined();
    expect(c.ascendant).toBeUndefined();
    expect(c.midheaven).toBeUndefined();
  });

  test('relationship evidence requires the exact pair for each named field',async()=>{
    const v=await buildVerifiedFactsV2('relationship',KNOWN_TIME_ORDINARY.birth);
    (v.reportData as any).relationshipEvidence.aspects.venusMars.pair='sun-pluto';
    expect(preflightReport('relationship',v).status).toBe('input_incomplete');
  });

  test('ID arrays in karmic evidence reject dangling nodal/chiron references',async()=>{
    const v=await buildVerifiedFactsV2('karmicshadow',KNOWN_TIME_ORDINARY.birth);
    const e:any=(v.reportData as any).karmicEvidence;
    e.nodalAspects=['natal.aspect.fake-node'];
    e.nodalSquares=['natal.aspect.fake-square'];
    e.chironAspects=['natal.aspect.fake-chiron'];
    expect(validateFactResolution(v).ok).toBe(false);
    expect(preflightReport('karmicshadow',v).status).toBe('input_incomplete');
  });

  test('vocation evidence names actual MC pairs rather than Sun substitutes',async()=>{
    const v=await buildVerifiedFactsV2('vocation',KNOWN_TIME_ORDINARY.birth);
    const e:any=(v.reportData as any).vocationEvidence;
    expect(e.saturnAspect.pair).toBe('saturn-midheaven');
    expect(e.jupiterAspect.pair).toBe('jupiter-midheaven');
    expect(e.plutoAspect.pair).toBe('pluto-midheaven');
  });

  test('wealth indicators are structured resolvable evidence, not unchecked labels',async()=>{
    const v=await buildVerifiedFactsV2('vocation',KNOWN_TIME_ORDINARY.birth);
    (v.reportData as any).vocationEvidence.wealthIndicators=['fake-wealth-indicator'];
    expect(validateFactResolution(v).ok).toBe(false);
  });

  test('near-29 fixture actually exercises the 29.xx boundary',()=>{
    expect(BOUNDARY_NEAR_29.expect.ref.sunDegreeInSign).toBeGreaterThanOrEqual(29);
    expect(BOUNDARY_NEAR_29.expect.ref.sunDegreeInSign).toBeLessThan(30);
  });

  test('a luminary receives the locked 10-degree major orb against a planet',()=>{
    const a=buildAspects(bodies([{key:'sun',longitude:0},{key:'jupiter',longitude:9}]) as any);
    expect(a.some(x=>x.value.aspectType==='conjunction')).toBe(true);
  });

  test('exact uses full-precision error before display rounding',()=>{
    const a=buildAspects(bodies([{key:'sun',longitude:0},{key:'moon',longitude:0.099}]) as any);
    const conj=a.find(x=>x.value.aspectType==='conjunction')!;
    expect(conj.value.orb).toBe(0.1);
    expect(conj.value.exact).toBe(true);
  });

  test('ruler facts carry the actual placement fields promised by T3-4',async()=>{
    const c=await computeVerifiedCommon(KNOWN_TIME_ORDINARY.birth);
    for(const r of [c.rulers!.dsc!,c.rulers!.second!,c.rulers!.sixth!,c.rulers!.tenth!,c.nodalRulers!.north,c.nodalRulers!.south]){
      const x:any=r;
      expect(typeof x.degreeInSign).toBe('number');
      // Node rulers use the locked 'nodal' sentinel; house rulers use a number.
      expect(typeof x.house === 'number' || x.house === 'nodal').toBe(true);
      expect(typeof x.retrograde).toBe('boolean');
      expect(Object.prototype.hasOwnProperty.call(x,'dignity')).toBe(true);
      expect(x.provenance).toContain(`natal.${x.ruler}.position`);
    }
  });

  test('Part-of-Fortune records which sect/formula generated the point',async()=>{
    const c=await computeVerifiedCommon(KNOWN_TIME_ORDINARY.birth);
    const p:any=c.partOfFortune!.value;
    expect(['day','night']).toContain(p.sect);
    expect(typeof p.formula).toBe('string');
    expect(p.formula.length).toBeGreaterThan(0);
  });
});
