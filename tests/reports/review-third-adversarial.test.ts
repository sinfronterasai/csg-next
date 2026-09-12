import { isValidAsOfDate } from '@/lib/reportFacts/build';
import { buildAspects, buildPatterns, computeVerifiedCommon, ASPECT_ORBS } from '@/lib/reportFacts/derived';
import { dignityFor } from '@/lib/astrology';
import { KNOWN_TIME_ORDINARY } from './fixtures/factsFixtures';

function chartOf(bodies: {key:string; longitude:number}[]): any {
  return {
    planets: bodies.map(b => ({
      key:b.key, label:b.key, longitude:b.longitude,
      sign: b.longitude < 30 ? 'aries' : b.longitude < 60 ? 'taurus' : b.longitude < 90 ? 'gemini' : b.longitude < 120 ? 'cancer' : b.longitude < 150 ? 'leo' : b.longitude < 180 ? 'virgo' : b.longitude < 210 ? 'libra' : b.longitude < 240 ? 'scorpio' : b.longitude < 270 ? 'sagittarius' : b.longitude < 300 ? 'capricorn' : b.longitude < 330 ? 'aquarius' : 'pisces',
      degreeInSign:b.longitude%30, house:1, retrograde:false,
    })),
    ascendant:{longitude:0}, midheaven:{longitude:0}, moon:{longitude:0}, sun:{longitude:0},
    birth:{date:'2000-01-01',location:'X'}
  };
}
function aspectsFor(chart:any): any[] {
  return buildAspects(chart.planets.map((p:any)=>({id:`natal.${p.key}.position`,key:p.key,label:p.label,longitude:p.longitude,full:p})) as any);
}
function patternsFor(chart:any): any[] {
  const aspects=aspectsFor(chart);
  const present=new Set(chart.planets.map((p:any)=>`natal.${p.key}.position`));
  return buildPatterns(chart,aspects,present);
}

describe('independent third review adversarial cases',()=>{
  test('rejects impossible but normalizable calendar dates',()=>{
    expect(isValidAsOfDate('2026-02-30')).toBe(false);
    expect(isValidAsOfDate('2025-02-29')).toBe(false);
  });

  test('detects T-square regardless of which participant is first',()=>{
    // First body is the apex (90); the opposition is between bodies 2 and 3.
    const chart=chartOf([{key:'sun',longitude:90},{key:'venus',longitude:0},{key:'mars',longitude:180}]);
    expect(patternsFor(chart).some((p:any)=>p.value.name==='TSquare')).toBe(true);
  });

  test('detects Yod regardless of which participant is first',()=>{
    // First body is apex (210); the sextile base is between bodies 2 and 3 (0/60).
    const chart=chartOf([{key:'sun',longitude:210},{key:'venus',longitude:0},{key:'mars',longitude:60}]);
    expect(patternsFor(chart).some((p:any)=>p.value.name==='Yod')).toBe(true);
  });

  test('locked aspect defaults use minor orb 2 and luminary orb 10',()=>{
    expect(ASPECT_ORBS.find(x=>x.type==='quincunx')?.orb).toBe(2);
    const luminaryConjunction=aspectsFor(chartOf([{key:'sun',longitude:0},{key:'moon',longitude:9}]));
    expect(luminaryConjunction.some((a:any)=>a.value.aspectType==='conjunction')).toBe(true);
  });

  test('house-ruler condition uses ruler planet placement, not cusp sign',async()=>{
    const common=await computeVerifiedCommon(KNOWN_TIME_ORDINARY.birth);
    const r=common.rulers!.dsc!;
    const planet=common.positions.find((p:any)=>p.id===`natal.${r.ruler}.position`)!;
    const v:any=planet.value;
    const d=dignityFor(r.ruler,v.sign);
    const label:any={domicile:'in domicile',exaltation:'exalted',detriment:'in detriment',fall:'in fall'};
    const expected=d ? label[d] : 'in no special dignity';
    expect(r.condition).toBe(expected);
    expect(r.sign).toBe(v.sign);
  });
});
