import { buildAspects, buildPatterns } from '@/lib/reportFacts/derived';

const sign=(d:number)=>['aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces'][Math.floor((((d%360)+360)%360)/30)];
function pattern(order:{key:string;longitude:number}[],name:'Yod'|'TSquare'){
  const planets=order.map(x=>({key:x.key,label:x.key,longitude:x.longitude,degreeInSign:x.longitude%30,sign:sign(x.longitude),house:1,retrograde:false}));
  const chart:any={planets};
  const aspects=buildAspects(planets.map((p:any)=>({id:`natal.${p.key}.position`,key:p.key,label:p.label,longitude:p.longitude,full:p})) as any);
  const found=buildPatterns(chart,aspects,new Set(planets.map(p=>`natal.${p.key}.position`))).filter((p:any)=>p.value.name===name);
  expect(found).toHaveLength(1);
  return found[0].id;
}
function perms<T>(a:T[]):T[][]{return a.length<2?[a]:a.flatMap((x,i)=>perms([...a.slice(0,i),...a.slice(i+1)]).map(p=>[x,...p]));}

describe('fourth review pattern identity',()=>{
  test('Yod identity is stable across all six participant input orders',()=>{
    const ids=perms([{key:'sun',longitude:210},{key:'venus',longitude:0},{key:'mars',longitude:60}]).map(p=>pattern(p,'Yod'));
    expect(new Set(ids).size).toBe(1);
  });
  test('T-square identity is stable across all six participant input orders',()=>{
    const ids=perms([{key:'sun',longitude:90},{key:'venus',longitude:0},{key:'mars',longitude:180}]).map(p=>pattern(p,'TSquare'));
    expect(new Set(ids).size).toBe(1);
  });
});
