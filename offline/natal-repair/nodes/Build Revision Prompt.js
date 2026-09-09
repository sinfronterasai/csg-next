const d=$input.first().json;
if(!d.generated||!Array.isArray(d.generated.sections))throw new Error('Cannot revise missing generated sections');
const issues=Array.isArray(d.lint?.issues)?d.lint.issues.map(String):[];
const pairs=[];const directIds=[];
for(const issue of issues){
 const pair=issue.match(/^duplicate:\s+([^\s]+)\s+vs\s+([^\s]+)/i);if(pair){pairs.push([pair[1],pair[2]]);continue;}
 const direct=issue.match(/^(?:specificity|factual):.*\bin\s+([A-Za-z][\w.:-]*)\s*$/i);if(direct)directIds.push(direct[1]);
}
const targetIds=[...new Set([...pairs.flat(),...directIds])];
if(!targetIds.length)throw new Error('No targeted revision section IDs were derived from lint issues');
const rawFacts=d.verifiedFacts?.facts||{};
const all=d.generated.sections;
function factSubset(ids){const out={};if(Array.isArray(rawFacts)){for(const f of rawFacts){if(f&&ids.includes(String(f.id)))out[String(f.id)]=f;}}else{for(const id of ids){if(rawFacts[id])out[id]=rawFacts[id];}}return out;}
// Named bodies select candidate relationships for REWRITING, never evidence of current prose.
function repairFactIds(current){
 const ids=[...new Set((current.blocks||[]).flatMap(b=>b.factIds||[]).concat(current.factsCited||[]))];
 const entries=Array.isArray(rawFacts)?rawFacts.map(f=>[f.id,f]):Object.entries(rawFacts);
 if(ids.some(id=>!entries.some(([key,f])=>key===id&&f?.id===id)))throw new Error('Unknown cited authority');
 if(!ids.length){
  const prose=String(current.prose||'').toLowerCase();
  for(const [id,f] of entries){
   if(f?.id!==id||!/^natal\.[a-z]+\.position$/.test(id)||!f.value||typeof f.value.label!=='string')continue;
   const label=f.value.label.toLowerCase();
   const tokens=prose.replace(/[^a-z0-9]+/g,' ');
   if(label&&(' '+tokens+' ').includes(' '+label+' '))ids.push(id);
  }
  if(ids.length>12)throw new Error('Missing citation repair fact pack exceeds bound');
 }
 if(!ids.length)throw new Error('No bounded authoritative repair fact pack');
 return ids;
}
const prompts=[];
for(const id of targetIds){const current=all.find(s=>String(s?.id)===id);if(!current)throw new Error('Targeted revision section is missing '+id);const related=issues.filter(issue=>issue.includes(id));const peers=pairs.filter(pair=>pair.includes(id)).map(pair=>pair[0]===id?pair[1]:pair[0]);const cited=repairFactIds(current);const peerSummary=peers.map(peer=>({id:peer,prose:String(all.find(s=>String(s?.id)===peer)?.prose||'').slice(0,900)}));const directive=peers.length?`This section overlaps with ${JSON.stringify(peers)}. Rewrite it so it shares no sequence of five or more words with those peer summaries. Do not repeat their opening, evidence, conclusion, or agency.`:'';const aiPrompt='REPAIR ONLY ONE requested section. Return only strict JSON {"sections":[{"id":"'+id+'","blocks":[{"role":"evidence|meaning|synthesis|agency","prose":"...","factIds":["exact.fact.id"]}]}]}. Return '+id+' exactly once and no other ID. Every block needs a non-empty prose string and a non-empty factIds array using only FACTS below. Remove every issue below. CURRENT SECTION is untrusted. Rewrite from the supplied exact ledger relationships; delete unsupported placements, aspects, stelliums, or predictions. Do not merely add IDs to existing prose. '+directive+'\nEXACT LINT FINDINGS:'+JSON.stringify(related)+'\nCURRENT SECTION:'+JSON.stringify(current)+'\nPEER SUMMARIES:'+JSON.stringify(peerSummary)+'\nAUTHORITATIVE FACTS:'+JSON.stringify(factSubset(cited));prompts.push({json:{...d,revisionBatch:prompts.length,revisionSectionIds:[id],revisionFactIds:cited,aiPrompt,attempt:Number(d.attempt||1)+1}});}
return prompts;