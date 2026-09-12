const d=$input.first().json;
const raw=d.verifiedFacts?.facts||{};
const entries=Array.isArray(raw)?raw.map(f=>[f?.id,f]):Object.entries(raw);
for(const section of d.generated?.sections||[]){
 for(const block of section.blocks||[]){
  if(!Array.isArray(block.factIds))block.factIds=[];
  const matches=entries.filter(([id,f])=>typeof id==='string'&&f?.id===id&&typeof f.display==='string'&&f.display.trim()&&block.prose===f.display);
  if(matches.length===1&&!block.factIds.includes(matches[0][0]))block.factIds.push(matches[0][0]);
 }
 section.factsCited=(section.blocks||[]).flatMap(b=>b.factIds||[]);
 section.prose=(section.blocks||[]).map(b=>String(b.prose||'')).join('\n\n');
}
return [{json:d}];