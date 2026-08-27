import { buildVerifiedFactsV2 } from '@/lib/reportFacts/build';
import { preflightReport } from '@/lib/reportFacts/schemas';
import { mechanicalJplTimestamps } from '@/lib/reportFacts/derived';
import { signFromLongitude } from '@/lib/astrology';
import { KNOWN_TIME_ORDINARY } from './fixtures/factsFixtures';

const clone=<T>(x:T):T=>JSON.parse(JSON.stringify(x));
const ordinal=(n:number)=>{const s=['th','st','nd','rd'],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0]);};
const DIGNITY_LABEL:Record<string,string>={domicile:'in domicile',exaltation:'exalted',detriment:'in detriment',fall:'in fall'};
const display=(v:any)=>{const {sign,degreeInSign}=signFromLongitude(v.longitude);const h=v.house!=null?` in the ${ordinal(v.house)} house`:'';const d=v.dignity?`, ${DIGNITY_LABEL[v.dignity as string]}`:'';const r=v.retrograde?' (retrograde)':'';const u=v.uncertain?' (approximate; birth time unknown)':'';return `${v.label} at ${degreeInSign.toFixed(2)}° ${sign.label}${h}${d}${r}${u}`;};

describe('sixteenth independent semantic probes',()=>{
  test.each([
    ['0001-01-01 09:00','0001-01-01 10:00',false],
    ['0004-02-29 09:00','0004-02-29 10:00',false],
    ['0099-12-31 23:00','0100-01-01 00:00',false],
    ['1900-02-29 09:00','1900-02-29 10:00',true],
    ['2000-02-29 09:00','2000-02-29 10:00',false],
    ['2100-02-29 09:00','2100-02-29 10:00',true],
    ['1990-02-29 09:00','1990-02-29 10:00',true],
    ['1990-04-31 09:00','1990-04-31 10:00',true],
  ])('strict JPL component round-trip for %s', (start,stop,shouldThrow)=>{
    if (shouldThrow) expect(()=>mechanicalJplTimestamps(start,stop,'1 h')).toThrow();
    else expect(()=>mechanicalJplTimestamps(start,stop,'1 h')).not.toThrow();
  });

  test('common.houses entries cannot be duplicated or aliased to keep num sequence with wrong longitudes',async()=>{
    const v:any=clone(await buildVerifiedFactsV2('natal',KNOWN_TIME_ORDINARY.birth));
    // Keep array order 11,12 but duplicate the 11th cusp content into both slots.
    const h11={...v.common.houses[10]};
    v.common.houses[10]=h11;
    v.common.houses[11]={...h11,num:12};
    expect(preflightReport('natal',v).status).toBe('input_incomplete');
  });

  test('common.houses num field cannot be spoofed independently of id/content',async()=>{
    const v:any=clone(await buildVerifiedFactsV2('natal',KNOWN_TIME_ORDINARY.birth));
    // Swap content but renumber to keep positional order valid.
    const a={...v.common.houses[0],num:1};
    const b={...v.common.houses[1],num:2};
    v.common.houses[0]={...b,num:1};
    v.common.houses[1]={...a,num:2};
    expect(preflightReport('natal',v).status).toBe('input_incomplete');
  });
});
