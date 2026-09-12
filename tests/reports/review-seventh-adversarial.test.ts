import { buildVerifiedFactsV2 } from '@/lib/reportFacts/build';
import { preflightReport } from '@/lib/reportFacts/schemas';
import { KNOWN_TIME_ORDINARY } from './fixtures/factsFixtures';

const dignityLabel:any={domicile:'in domicile',exaltation:'exalted',detriment:'in detriment',fall:'in fall'};
const missing=(rt:any,v:any)=>preflightReport(rt,v).missing.join(' | ');

describe('seventh independent review semantic bypasses',()=>{
  test('house ruler must be derived from cusp sign, not self-declared ruler id',async()=>{
    const v=await buildVerifiedFactsV2('relationship',KNOWN_TIME_ORDINARY.birth);
    const r:any=(v.reportData as any).relationshipEvidence.seventhHouseRuler;
    const alternate='sun';
    expect(r.ruler).not.toBe(alternate);
    const p:any=v.facts[`natal.${alternate}.position`].value;
    r.ruler=alternate;
    r.rulerLabel='syntactically valid but false label';
    r.sign=p.sign;
    r.degreeInSign=p.degreeInSign;
    r.house_of_ruler=p.house;
    r.retrograde=p.retrograde;
    r.dignity=p.dignity;
    r.condition=p.dignity?dignityLabel[p.dignity]:`in ${p.signLabel}`;
    r.provenance=['common.cusp.7',`natal.${alternate}.position`];
    expect(preflightReport('relationship',v).status).toBe('input_incomplete');
  });

  test('common aliases must equal canonical facts for retrograde dignity key and label too',async()=>{
    const v=await buildVerifiedFactsV2('natal',KNOWN_TIME_ORDINARY.birth);
    const j:any=v.common.juno;
    j.retrograde=!j.retrograde;
    j.dignity=j.dignity===null?'domicile':null;
    j.key='sun';
    j.label='False label';
    expect(preflightReport('natal',v).status).toBe('input_incomplete');
  });

  test('authoritative nodal completeness derives from immutable facts, not mutable common array',async()=>{
    const v=await buildVerifiedFactsV2('karmicshadow',KNOWN_TIME_ORDINARY.birth);
    const e:any=(v.reportData as any).karmicEvidence;
    const id=e.nodalAspects.find((x:string)=>{
      const a:any=v.facts[x].value;
      return a.bodyA!=='chiron'&&a.bodyB!=='chiron';
    });
    expect(id).toBeDefined();
    // Hide a still-existing canonical fact from both the mutable common index and evidence lists.
    v.common.aspects=v.common.aspects.filter(a=>a.id!==id);
    e.nodalAspects=e.nodalAspects.filter((x:string)=>x!==id);
    e.nodalSquares=e.nodalSquares.filter((x:string)=>x!==id);
    expect(v.facts[id]).toBeDefined();
    expect(preflightReport('karmicshadow',v).status).toBe('input_incomplete');
  });

  test('Vocation complete MC set derives from immutable facts and detects coordinated omission',async()=>{
    const v=await buildVerifiedFactsV2('vocation',KNOWN_TIME_ORDINARY.birth);
    const e:any=(v.reportData as any).vocationEvidence;
    const protectedIds=new Set([e.saturnAspect.aspectId,e.jupiterAspect.aspectId,e.plutoAspect.aspectId].filter(Boolean));
    const id=e.mcAspects.find((x:string)=>!protectedIds.has(x));
    expect(id).toBeDefined();
    v.common.aspects=v.common.aspects.filter(a=>a.id!==id);
    e.mcAspects=e.mcAspects.filter((x:string)=>x!==id);
    const surfaced:any=v.facts['reportData.vocationEvidence'];
    surfaced.provenance=surfaced.provenance.filter((x:string)=>x!==id);
    expect(v.facts[id]).toBeDefined();
    expect(missing('vocation',v)).toMatch(/mcAspects|provenance|authoritative/);
  });
});
