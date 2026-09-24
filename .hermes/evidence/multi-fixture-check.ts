import { buildVerifiedFactsV2 } from '../../src/lib/reportFacts/build';
async function main() {
const cases=[
 {name:'Santa Cruz',date:'1980-03-09',time:'16:21',location:'Santa Cruz, California'},
 {name:'Paris',date:'1990-06-15',time:'12:00',location:'Paris'},
 {name:'Sydney quiet',date:'1988-02-10',time:'14:20',location:'Sydney'},
];
for(const b of cases){const l:any=await buildVerifiedFactsV2('vocation',b,'2026-09-23');const p=l.reportData.vocationEvidence.careerWindowPack;console.log(JSON.stringify({name:b.name,timezone:p.displayTimezone,period:p.period,months:p.months.length,windows:p.windows.length,birth:p.birthSnapshot}));}
}
main().catch(e=>{console.error(e);process.exit(1)});
