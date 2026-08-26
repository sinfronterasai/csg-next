import { buildVerifiedFactsV2 } from '@/lib/reportFacts/build';
import { preflightReport } from '@/lib/reportFacts/schemas';
import { isExactAspect, isTightAspect, EXACT_ASPECT_EPSILON, TIGHT_ASPECT_THRESHOLD } from '@/lib/reportFacts/derived';
import { computeChart } from '@/lib/chartEngine';
import { buildPatterns } from '@/lib/reportFacts/derived';
import { KNOWN_TIME_ORDINARY, RETRO_NULL_DIGNITY } from './fixtures/factsFixtures';

const missing=(rt:any,v:any)=>preflightReport(rt,v).missing.join(' | ');

describe('sixth independent review semantic cases',()=>{
  test('POF metadata is validated for every known-time report, not Natal only',async()=>{
    const v=await buildVerifiedFactsV2('relationship',KNOWN_TIME_ORDINARY.birth);
    (v.common.partOfFortune!.value as any).sect='twilight';
    expect(missing('relationship',v)).toContain('partOfFortune');
  });

  test('POF validator rejects impossible longitudes and mismatched sign/degree',async()=>{
    const v=await buildVerifiedFactsV2('natal',KNOWN_TIME_ORDINARY.birth);
    const p:any=v.common.partOfFortune!.value;
    p.longitude=999;
    p.sign='aries';
    p.degreeInSign=5;
    expect(preflightReport('natal',v).status).toBe('input_incomplete');
  });

  test('ruler validator cross-checks all fields against cited ruler placement',async()=>{
    const v=await buildVerifiedFactsV2('relationship',KNOWN_TIME_ORDINARY.birth);
    const r:any=(v.reportData as any).relationshipEvidence.seventhHouseRuler;
    r.sign=r.sign==='aries'?'taurus':'aries';
    r.degreeInSign=12.34;
    r.house_of_ruler=12;
    r.retrograde=!r.retrograde;
    r.dignity=null;
    r.condition='syntactically valid but false';
    r.provenance=['natal.sun.position'];
    expect(preflightReport('relationship',v).status).toBe('input_incomplete');
  });

  test('aspect-hit evidence provenance is exactly the cited aspect id',async()=>{
    const v=await buildVerifiedFactsV2('relationship',KNOWN_TIME_ORDINARY.birth);
    const all:any=Object.values((v.reportData as any).relationshipEvidence.aspects);
    const e:any=all.find((x:any)=>x.aspectId!==null);
    expect(e).toBeDefined();
    e.provenance=[e.aspectId,'natal.sun.position'];
    expect(preflightReport('relationship',v).status).toBe('input_incomplete');
  });

  test('Vocation MC sign and degree must match the cited MC position fact',async()=>{
    const v=await buildVerifiedFactsV2('vocation',KNOWN_TIME_ORDINARY.birth);
    const e:any=(v.reportData as any).vocationEvidence;
    e.mcSign=e.mcSign==='aries'?'taurus':'aries';
    e.mcDegreeInSign=(e.mcDegreeInSign+5)%30;
    const m=missing('vocation',v);
    expect(m).toMatch(/mcSign|mcDegree/);
  });

  test('Vocation mcAspects must equal the complete authoritative set',async()=>{
    const v=await buildVerifiedFactsV2('vocation',KNOWN_TIME_ORDINARY.birth);
    const e:any=(v.reportData as any).vocationEvidence;
    expect(e.mcAspects.length).toBeGreaterThan(0);
    e.mcAspects=e.mcAspects.slice(1);
    expect(missing('vocation',v)).toContain('mcAspects');
  });

  test('wealthIndicators must equal unique 2nd/6th/10th ruler positions',async()=>{
    const v=await buildVerifiedFactsV2('vocation',KNOWN_TIME_ORDINARY.birth);
    (v.reportData as any).vocationEvidence.wealthIndicators=['natal.sun.position'];
    expect(missing('vocation',v)).toContain('wealthIndicators');
  });

  test('optional Chiron absence reason is the exact deterministic report reason',async()=>{
    const v=await buildVerifiedFactsV2('loveblueprint',KNOWN_TIME_ORDINARY.birth);
    const e:any=(v.reportData as any).loveBlueprintEvidence;
    if(e.chironEvidence.present){
      e.chironEvidence={present:false,ids:[],reason:'arbitrary but nonempty'};
      e.chironAspects=[];
    }else e.chironEvidence.reason='arbitrary but nonempty';
    expect(preflightReport('loveblueprint',v).status).toBe('input_incomplete');
  });

  test('Vocation surfaced evidence provenance remains equal to all evidence citations',async()=>{
    const v=await buildVerifiedFactsV2('vocation',KNOWN_TIME_ORDINARY.birth);
    const f:any=v.facts['reportData.vocationEvidence'];
    f.provenance=f.provenance.filter((x:string)=>!x.startsWith('natal.aspect.'));
    expect(missing('vocation',v)).toMatch(/provenance|mcAspects.*complete|evidence citations/);
  });


  // F6-9: karmic nodalAspects must EQUAL the complete authoritative set (not merely
  // contain valid members). Dropping or adding a member must fail.
  test('F6-9 karmic nodalAspects must equal the complete authoritative node-aspect set', async () => {
    const v = await buildVerifiedFactsV2('karmicshadow', KNOWN_TIME_ORDINARY.birth);
    const e: any = (v.reportData as any).karmicEvidence;
    expect(Array.isArray(e.nodalAspects) && e.nodalAspects.length > 0).toBe(true);
    // Drop one member -> omission must be caught.
    e.nodalAspects = e.nodalAspects.slice(1);
    expect(preflightReport('karmicshadow', v).status).toBe('input_incomplete');
  });
  test('F6-9 karmic Chiron aspects must equal the complete authoritative (Chiron+node) set', async () => {
    const v = await buildVerifiedFactsV2('karmicshadow', KNOWN_TIME_ORDINARY.birth);
    const e: any = (v.reportData as any).karmicEvidence;
    // Add a bogus extra (duplicate of first) -> duplicate/extra must be caught.
    e.chironAspects = e.chironAspects.length ? [...e.chironAspects, e.chironAspects[0]] : ['natal.aspect.venus-mars-trine'];
    expect(preflightReport('karmicshadow', v).status).toBe('input_incomplete');
  });
  test('F6-9 love-blueprint Chiron aspects must equal the complete authoritative (Chiron+Venus/Moon) set', async () => {
    const v = await buildVerifiedFactsV2('loveblueprint', KNOWN_TIME_ORDINARY.birth);
    const e: any = (v.reportData as any).loveBlueprintEvidence;
    if (e.chironAspects && e.chironAspects.length) {
      e.chironAspects = e.chironAspects.slice(1); // omit one -> must fail
      expect(preflightReport('loveblueprint', v).status).toBe('input_incomplete');
    } else {
      // Absent present state: reason must be exact; adding a bogus aspect must fail.
      e.chironAspects = ['natal.aspect.venus-mars-trine'];
      expect(preflightReport('loveblueprint', v).status).toBe('input_incomplete');
    }
  });

  // F6-11: exact/tight predicates use strict <; equality at the threshold is FALSE.
  test('F6-11 exact/tight thresholds: minus passes, equality is false, plus fails', () => {
    const EPS = EXACT_ASPECT_EPSILON, TIGHT = TIGHT_ASPECT_THRESHOLD;
    // exact
    expect(isExactAspect(EPS - 0.01)).toBe(true);   // minus
    expect(isExactAspect(EPS)).toBe(false);         // equal -> strict < is false
    expect(isExactAspect(EPS + 0.01)).toBe(false);  // plus
    // tight
    expect(isTightAspect(TIGHT - 0.01)).toBe(true); // minus
    expect(isTightAspect(TIGHT)).toBe(false);       // equal -> strict < is false
    expect(isTightAspect(TIGHT + 0.01)).toBe(false);// plus
  });

  // F6-10: Stellium serialization is canonical across input permutations (deep equality
  // of id, kind, source, display, value, provenance) without sorting away defects.
  test('F6-10 stellium fact is identical across chart planet permutations', async () => {
    const base: any = await computeChart(RETRO_NULL_DIGNITY.birth);
    const presentIds = new Set(base.planets.map((p: any) => `natal.${p.key}.position`));
    const stelliumOf = (orderedPlanets: any[]) => {
      const chart = { ...base, planets: orderedPlanets };
      const pats: any[] = buildPatterns(chart, [], presentIds);
      return pats.find((p: any) => p.value.name === 'Stellium');
    };
    const fwd = stelliumOf([...base.planets]);
    // reverse permutation (same planets, different input order)
    const rev = stelliumOf([...base.planets].reverse());
    expect(fwd).toBeDefined();
    expect(rev).toBeDefined();
    const keys = ['id', 'kind', 'source', 'display', 'value', 'provenance'] as const;
    for (const k of keys) {
      expect(JSON.stringify(rev[k])).toBe(JSON.stringify(fwd[k]));
    }
    // Participants must be sorted (canonical), not in input order.
    const parts: string[] = fwd.value.participants;
    expect([...parts].sort()).toEqual(parts);
  });

  // F6-12: aspect identity is validated against STRUCTURED endpoint keys, not by
  // recovering from the presentation pair string. Tamper the real aspect's endpoints
  // to bodies that do NOT match the structured expected [venus, mars] keys while leaving
  // ev.pair untouched: the structured-key identity check must reject it.
  test('F6-12 aspect identity uses structured endpoint keys, not pair-string recovery', async () => {
    const v = await buildVerifiedFactsV2('relationship', KNOWN_TIME_ORDINARY.birth);
    const all: any = Object.values((v.reportData as any).relationshipEvidence.aspects);
    const e: any = all.find((x: any) => x.aspectId !== null && x.pair === 'venus-saturn');
    expect(e).toBeDefined();
    // Leave ev.pair correct; corrupt the REAL fact endpoints to non-matching bodies.
    const fact: any = v.facts[e.aspectId];
    fact.value.bodyA = 'sun';
    fact.value.bodyB = 'jupiter';
    expect(preflightReport('relationship', v).status).toBe('input_incomplete');
  });
});
