// Offline only: compile reviewed Code-node patches; never calls n8n.
const fs=require('node:fs'),path=require('node:path');const root=__dirname;
const read=n=>fs.readFileSync(path.join(root,'baseline',n+'.js'),'utf8');
const write=(n,s)=>{fs.mkdirSync(path.join(root,'nodes'),{recursive:true});fs.writeFileSync(path.join(root,'nodes',n+'.js'),s);};
for(const file of fs.readdirSync(path.join(root,'baseline')))write(file.slice(0,-3),read(file.slice(0,-3)));
let revision=read('Build Revision Prompt');
revision=revision.replace('const prompts=[];',`// Named bodies select candidate relationships for REWRITING, never evidence of current prose.
function repairFactIds(current){
 const ids=[...new Set((current.blocks||[]).flatMap(b=>b.factIds||[]).concat(current.factsCited||[]))];
 const entries=Array.isArray(rawFacts)?rawFacts.map(f=>[f.id,f]):Object.entries(rawFacts);
 if(ids.some(id=>!entries.some(([key,f])=>key===id&&f?.id===id)))throw new Error('Unknown cited authority');
 if(!ids.length){
  const prose=String(current.prose||'').toLowerCase();
  for(const [id,f] of entries){
   if(f?.id!==id||!/^natal\\.[a-z]+\\.position$/.test(id)||!f.value||typeof f.value.label!=='string')continue;
   const label=f.value.label.toLowerCase();
   const tokens=prose.replace(/[^a-z0-9]+/g,' ');
   if(label&&(' '+tokens+' ').includes(' '+label+' '))ids.push(id);
  }
  if(ids.length>12)throw new Error('Missing citation repair fact pack exceeds bound');
 }
 if(!ids.length)throw new Error('No bounded authoritative repair fact pack');
 return ids;
}
const prompts=[];`);
revision=revision.replace("const cited=[...new Set(Array.isArray(current.factsCited)?current.factsCited.map(String):[])];","const cited=repairFactIds(current);");
revision=revision.replace('Remove every issue below. ','Remove every issue below. CURRENT SECTION is untrusted. Rewrite from the supplied exact ledger relationships; delete unsupported placements, aspects, stelliums, or predictions. Do not merely add IDs to existing prose. ');
revision=revision.replace('revisionSectionIds:[id],aiPrompt','revisionSectionIds:[id],revisionFactIds:cited,aiPrompt');
write('Build Revision Prompt',revision);
let merge=read('Merge Bounded Revision Sections');
merge=merge.replace("b.prose=b.prose.replace", "if(!b.prose.trim()||!b.factIds.length||!b.factIds.every(id=>typeof id==='string'&&(p.revisionFactIds||[]).includes(id)))throw new Error('Invalid replacement authoritative citations');b.prose=b.prose.replace");
write('Merge Bounded Revision Sections',merge);
// Deliberately conservative: only an entire literal ledger display is safe to backfill.
// Interpretation, paraphrases, decimal claims and multiple relationships go through repair/judge.
const normalize=`const d=$input.first().json;
const raw=d.verifiedFacts?.facts||{};
const entries=Array.isArray(raw)?raw.map(f=>[f?.id,f]):Object.entries(raw);
for(const section of d.generated?.sections||[]){
 for(const block of section.blocks||[]){
  if(!Array.isArray(block.factIds))block.factIds=[];
  const matches=entries.filter(([id,f])=>typeof id==='string'&&f?.id===id&&typeof f.display==='string'&&f.display.trim()&&block.prose===f.display);
  if(matches.length===1&&!block.factIds.includes(matches[0][0]))block.factIds.push(matches[0][0]);
 }
 section.factsCited=(section.blocks||[]).flatMap(b=>b.factIds||[]);
 section.prose=(section.blocks||[]).map(b=>String(b.prose||'')).join('\\n\\n');
}
return [{json:d}];`;
for(const n of ['Normalize Initial Placement Citations','Normalize Lint Revision Citations','Normalize Judge Repair Citations'])write(n,normalize);
const contract=require('./judge-contract.cjs');
for(const [name,prefix] of [['Build Judge Prompt','judge'],['Build Rejudge Prompt','rejudge']]){
 const instructions='Independently judge the CURRENT report only, not prior findings. Return ONLY strict JSON with every field of SCHEMA. Free requires >=3; paid requires >=4 on EVERY score. Pass requires every hard gate true, no issues, no failedSections, no flags. A citation ID alone is not proof: compare each asserted planet, sign, exact degree, house, aspect participants/type/orb, ruler and pattern against the same block cited ledger value. A decimal point is not a sentence boundary. Unsupported relationships fail factual; absent citations fail specific. Use roles to assess evidence/meaning/synthesis/agency structure. Every failed gate needs affected allowed sections and actionable issues. Only exact supplied fact IDs are permitted. Use specificity as the canonical issue category and specific as the hard-gate key. Safety/banned/age-consent findings are not repairable. Never invent authority. ';
 write(name,`const d=$input.first().json;
const compactReport=(d.generated?.sections||[]).map(s=>({id:s.id,blocks:(s.blocks||[]).map(b=>({role:b.role,prose:b.prose,factIds:b.factIds||[]}))}));
const cited=[...new Set(compactReport.flatMap(s=>s.blocks.flatMap(b=>b.factIds)))];
const raw=d.verifiedFacts?.facts||{};
const entries=Array.isArray(raw)?raw.map(f=>[f?.id,f]):Object.entries(raw);
const facts=Object.fromEntries(entries.filter(([id,f])=>f?.id===id&&cited.includes(id)));
if(cited.some(id=>!Object.hasOwn(facts,id)))throw new Error('Unknown cited authoritative fact ID');
const aiPrompt=${JSON.stringify(instructions)}+'SCHEMA:'+${JSON.stringify(JSON.stringify(contract.shape))}+'\\nTIER:'+d.tier+'\\nALLOWED SECTION IDS:'+JSON.stringify(compactReport.map(s=>s.id))+'\\nCITED AUTHORITATIVE FACTS:'+JSON.stringify(facts)+'\\nCURRENT REPORT:'+JSON.stringify(compactReport);
if(aiPrompt.length>90000)throw new Error('Bounded judge prompt exceeds 90000 characters');
return [{json:{...d,aiPrompt,${prefix}FactIds:cited,${prefix}FactCount:Object.keys(facts).length,${prefix}PromptChars:aiPrompt.length${prefix==='rejudge'?',attempt:3':''}}}];`);
}

const shared=['schemaVersion','hardGates','scores','categories'].map(k=>`const ${k}=${JSON.stringify(contract[k])};`).join('\n')+'\n'+contract.validateJudge.toString();
for(const [name,upstream,key,error] of [['Classify Judge Result','Build Judge Prompt','firstJudge','judgeContractError'],['Parse Rejudge Contract','Build Rejudge Prompt','rejudge','rejudgeContractError']]){
 write(name,shared+`\nconst d=$('${upstream}').first().json;
const raw=$input.first().json.text??$input.first().json.output??$input.first().json.content??'';
try{const result=validateJudge(raw,d);return [{json:{...d,${key}:result.judge,${error}:false,judgeNeedsRevision:${key==='firstJudge'?'result.repairable':'false'},attempt:${key==='firstJudge'?'1':'3'}}}];}
catch(_){return [{json:{...d,${key}:null,${error}:true,judgeNeedsRevision:false,attempt:${key==='firstJudge'?'1':'3'}}}];}`);
}
