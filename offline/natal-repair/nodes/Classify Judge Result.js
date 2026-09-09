const schemaVersion="csg.judge.v1";
const hardGates=["factual","banned","specific","dup","tone","structure","length","ageConsent"];
const scores=["precision","insightDensity","voiceFit","empowerment","personalization","clarity","cohesion"];
const categories=["factual","structure","specificity","narrative","tone","duplication","length","safety"];
function validateJudge(raw,d){
 const fail=()=>{throw new Error('Judge contract rejected');};
 const exact=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
 const unique=a=>new Set(a).size===a.length;
 const nonblank=s=>typeof s==='string'&&s.trim().length>0;
 // Strict JSON only: syntax recovery must not manufacture missing fields or truncate diagnostics.
 if(typeof raw!=='string'||!raw.trim())fail();
 const j=JSON.parse(raw);
 if(!exact(j,['schemaVersion','hardGates','scores','verdict','failedSections','issues','flags','notes'])||j.schemaVersion!==schemaVersion)fail();
 if(!exact(j.hardGates,hardGates)||!hardGates.every(k=>typeof j.hardGates[k]==='boolean')||!exact(j.scores,scores)||!scores.every(k=>Number.isInteger(j.scores[k])&&j.scores[k]>=1&&j.scores[k]<=5))fail();
 const sections=d.generated?.sections||[],allowed=new Set(sections.map(s=>s.id));
 const rawFacts=d.verifiedFacts?.facts||{};
 const entries=Array.isArray(rawFacts)?rawFacts.map(f=>[f?.id,f]):Object.entries(rawFacts);
 const facts=new Set(entries.filter(([id,f])=>nonblank(id)&&f?.id===id).map(([id])=>id));
 const offered=d.rejudgeFactIds||d.judgeFactIds;
 const known=id=>nonblank(id)&&facts.has(id)&&(!offered||offered.includes(id));
 if(!['pass','revise','reject'].includes(j.verdict)||!Array.isArray(j.failedSections)||!unique(j.failedSections)||!j.failedSections.every(id=>typeof id==='string'&&allowed.has(id))||!Array.isArray(j.issues)||!Array.isArray(j.flags)||!j.flags.every(nonblank)||typeof j.notes!=='string')fail();
 for(const i of j.issues){
  if(!exact(i,['section','category','repairable','problem','requiredFix','factIds']))fail();
  // Explicit legacy alias at input only; prompts emit canonical specificity.
  if(i.category==='specific')i.category='specificity';
  if(!allowed.has(i.section)||!j.failedSections.includes(i.section)||!categories.includes(i.category)||typeof i.repairable!=='boolean'||!nonblank(i.problem)||!nonblank(i.requiredFix)||!Array.isArray(i.factIds)||!unique(i.factIds)||!i.factIds.every(known)||(i.repairable&&!i.factIds.length))fail();
 }
 if(!j.failedSections.every(id=>j.issues.some(i=>i.section===id)))fail();
 const threshold=d.tier==='paid'?4:3;
 if(j.verdict==='pass'&&(!hardGates.every(k=>j.hardGates[k])||!scores.every(k=>j.scores[k]>=threshold)||j.failedSections.length||j.issues.length||j.flags.length))fail();
 const categoryGate={factual:'factual',specificity:'specific',structure:'structure',duplication:'dup',tone:'tone',length:'length'};
 const covered=hardGates.filter(k=>!j.hardGates[k]).every(k=>j.issues.some(i=>categoryGate[i.category]===k));
 const safe=j.hardGates.banned&&j.hardGates.ageConsent&&!j.flags.length&&!j.issues.some(i=>i.category==='safety'||!i.repairable);
 // Preserve existing repair policy: factual/specific failure, one judge repair only.
 const repairable=j.verdict==='revise'&&safe&&covered&&(j.hardGates.factual===false||j.hardGates.specific===false)&&j.failedSections.length>0&&j.issues.length>0;
 return {judge:j,repairable:Boolean(repairable)};
}
const d=$('Build Judge Prompt').first().json;
const raw=$input.first().json.text??$input.first().json.output??$input.first().json.content??'';
try{const result=validateJudge(raw,d);return [{json:{...d,firstJudge:result.judge,judgeContractError:false,judgeNeedsRevision:result.repairable,attempt:1}}];}
catch(_){return [{json:{...d,firstJudge:null,judgeContractError:true,judgeNeedsRevision:false,attempt:1}}];}