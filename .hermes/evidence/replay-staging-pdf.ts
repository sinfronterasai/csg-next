import { readFileSync } from 'node:fs';
import { buildVocationPdf } from '../../src/lib/vocationPdf';
async function main() {
const row:any = JSON.parse(readFileSync('.hermes/evidence/staging-row-1279.json','utf8'));
const result=row.result; const ledger=result.metadata.verifiedFacts; const pack=ledger.reportData.vocationEvidence.careerWindowPack;
const pdf=await buildVocationPdf({title:result.title,name:'Vocation',birth:result.metadata.birthData,pack,sections:result.pipeline.sections.map((s:any)=>({id:s.id,heading:s.id,prose:s.prose}))});
console.log(pdf.length);
}
main().catch((e)=>{console.error(e);process.exit(1)});
