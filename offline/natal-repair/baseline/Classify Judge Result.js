const d=$('Build Judge Prompt').first().json;
const raw=$input.first().json.text ?? $input.first().json.output ?? $input.first().json.content ?? '';
const text=String(raw).trim().replace(/^```(?:json)?/i,'').replace(/```$/,'').trim();
let judge=null; try{judge=JSON.parse(text)}catch(_){try{judge=JSON.parse(require('jsonrepair').jsonrepair(text))}catch(__){}}
const allowed=new Set((d.generated?.sections||[]).map(s=>String(s.id)));
const issues=Array.isArray(judge?.issues)?judge.issues:[];
const failed=[...new Set((Array.isArray(judge?.failedSections)?judge.failedSections:[]).map(String))];
const repairableCategories=new Set(['factual','specific','specificity','structure','narrative','tone','duplication','length']);
const issueValid=issues.length>0&&issues.every(i=>i&&allowed.has(String(i.section))&&repairableCategories.has(String(i.category))&&typeof i.repairable==='boolean'&&typeof i.problem==='string'&&typeof i.requiredFix==='string'&&Array.isArray(i.factIds));
const repairGateFailed=judge?.hardGates?.factual===false||judge?.hardGates?.specific===false;
const repairable=repairGateFailed&&issueValid&&failed.length>0&&failed.every(id=>allowed.has(id))&&failed.every(id=>issues.some(i=>String(i.section)===id&&i.repairable===true));
return [{json:{...d,firstJudge:judge,judgeRawOutput:String(raw),judgeNeedsRevision:repairable,attempt:1}}];