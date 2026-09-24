import { buildVerifiedFactsV2 } from '../../src/lib/reportFacts/build';
import { ALL_FIXTURES } from '../../tests/reports/fixtures/factsFixtures';
async function main(){for(const f of ALL_FIXTURES.filter(x=>x.expect.knownTime)){const l:any=await buildVerifiedFactsV2('vocation',f.birth,'2026-09-23');const p=l.reportData.vocationEvidence.careerWindowPack;console.log(f.name,p.displayTimezone,p.windows.length)}}
main().catch(e=>{console.error(e);process.exit(1)})
