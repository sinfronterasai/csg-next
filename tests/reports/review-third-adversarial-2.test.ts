import { buildVerifiedFactsV2 } from '@/lib/reportFacts/build';
import { preflightReport, validateFactResolution } from '@/lib/reportFacts/schemas';
import { computeVerifiedCommon } from '@/lib/reportFacts/derived';
import { KNOWN_TIME_ORDINARY, ALL_FIXTURES } from './fixtures/factsFixtures';

const norm=(x:number)=>((x%360)+360)%360;
const clone=<T>(x:T):T=>JSON.parse(JSON.stringify(x));
const LOCATION_ANCHORS: Record<string,{latitude:number;longitude:number;timezone:string}> = {
  paris: { latitude: 48.8566, longitude: 2.3522, timezone: 'Europe/Paris' },
  berlin: { latitude: 52.52, longitude: 13.405, timezone: 'Europe/Berlin' },
  london: { latitude: 51.5074, longitude: -0.1278, timezone: 'Europe/London' },
  tokyo: { latitude: 35.6762, longitude: 139.6503, timezone: 'Asia/Tokyo' },
  'new york': { latitude: 40.7128, longitude: -74.006, timezone: 'America/New_York' },
  sydney: { latitude: -33.8688, longitude: 151.2093, timezone: 'Australia/Sydney' },
  'mexico city, mexico': { latitude: 19.4326, longitude: -99.1332, timezone: 'America/Mexico_City' },
};
const deterministicBirth=(birth:any)=>({ ...birth, ...(LOCATION_ANCHORS[birth.location.toLowerCase()] ?? {}) });

describe('independent third review adversarial contract cases 2',()=>{
  let natalFacts:any;
  let relationshipFacts:any;
  let vocationFacts:any;
  let commonFacts=new Map<string,any>();

  beforeAll(async () => {
    const ordinaryBirth=deterministicBirth(KNOWN_TIME_ORDINARY.birth);
    [natalFacts,relationshipFacts,vocationFacts] = await Promise.all([
      buildVerifiedFactsV2('natal', ordinaryBirth),
      buildVerifiedFactsV2('relationship', ordinaryBirth),
      buildVerifiedFactsV2('vocation', ordinaryBirth),
    ]);
    for (const fixture of ALL_FIXTURES.filter(x=>x.expect.knownTime)) {
      commonFacts.set(fixture.name, await computeVerifiedCommon(deterministicBirth(fixture.birth)));
    }
  }, 120000);
  test('aspect grid is globally strongest-first by ascending orb',async()=>{
    const v=clone(natalFacts);
    const orbs=v.common.aspects.map(a=>a.value.orb);
    expect(orbs).toEqual([...orbs].sort((a,b)=>a-b));
  });

  test('nested evidence aspect ids/provenance must resolve',async()=>{
    const v=clone(relationshipFacts);
    const e:any=(v.reportData as any).relationshipEvidence.aspects.venusMars;
    e.aspectId='natal.aspect.fake';
    e.provenance=['natal.aspect.fake'];
    expect(preflightReport('relationship',v).status).toBe('input_incomplete');
    expect(validateFactResolution(v).ok).toBe(false);
  });

  test('relationship scoreDrivers cannot contain dangling fact ids',async()=>{
    const v=clone(relationshipFacts);
    (v.reportData as any).relationshipEvidence.scoreDrivers=['score.relationship.fake'];
    expect(preflightReport('relationship',v).status).toBe('input_incomplete');
    expect(validateFactResolution(v).ok).toBe(false);
  });

  test('vocation emits a complete deterministic 24-month career-window pack',async()=>{
    const v=clone(vocationFacts);
    expect((v.reportData as any).vocationEvidence.careerWindowsDeclared).toBe(true);
    expect(preflightReport('vocation',v).status).toBe('complete');
    expect((v.reportData as any).vocationEvidence.careerWindowPack.months).toHaveLength(24);
  });

  test('Part of Fortune switches day/night formula based on solar sect',async()=>{
    let checkedNight=0;
    for(const f of ALL_FIXTURES.filter(x=>x.expect.knownTime)){
      const c=commonFacts.get(f.name)!;
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
