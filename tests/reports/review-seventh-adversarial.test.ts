import { buildVerifiedFactsV2 } from '@/lib/reportFacts/build';
import { preflightReport } from '@/lib/reportFacts/schemas';
import { KNOWN_TIME_ORDINARY } from './fixtures/factsFixtures';

const dignityLabel:any={domicile:'in domicile',exaltation:'exalted',detriment:'in detriment',fall:'in fall'};
const missing=(rt:any,v:any)=>preflightReport(rt,v).missing.join(' | ');
const DETERMINISTIC_PARIS_BIRTH = {
  ...KNOWN_TIME_ORDINARY.birth,
  latitude: 48.8566,
  longitude: 2.3522,
  timezone: 'Europe/Paris',
};
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
let factsCache: Record<'relationship' | 'natal' | 'karmicshadow' | 'vocation', any>;
const freshFacts = (reportType: keyof typeof factsCache) => clone(factsCache[reportType]);

describe('seventh independent review semantic bypasses',()=>{
  beforeAll(async () => {
    factsCache = {
      relationship: await buildVerifiedFactsV2('relationship', DETERMINISTIC_PARIS_BIRTH),
      natal: await buildVerifiedFactsV2('natal', DETERMINISTIC_PARIS_BIRTH),
      karmicshadow: await buildVerifiedFactsV2('karmicshadow', DETERMINISTIC_PARIS_BIRTH),
      vocation: await buildVerifiedFactsV2('vocation', DETERMINISTIC_PARIS_BIRTH),
    };
  }, 60000);
  test('house ruler must be derived from cusp sign, not self-declared ruler id',async()=>{
    const v=freshFacts('relationship');
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
    const v=freshFacts('natal');
    const j:any=v.common.juno;
    j.retrograde=!j.retrograde;
    j.dignity=j.dignity===null?'domicile':null;
    j.key='sun';
    j.label='False label';
    expect(preflightReport('natal',v).status).toBe('input_incomplete');
  });

  test('authoritative nodal completeness derives from immutable facts, not mutable common array',async()=>{
    const v=freshFacts('karmicshadow');
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
    const v=freshFacts('vocation');
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
