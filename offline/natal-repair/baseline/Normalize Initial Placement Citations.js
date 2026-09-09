const d=$input.first().json;
const facts=d.verifiedFacts?.facts||{};
const hasFact=id=>Array.isArray(facts)?facts.some(f=>String(f?.id)===id):Boolean(facts[id]);
const requirements=[
  {id:'natal.venus.position',pattern:/\bvenus\b[^.]{0,140}\b(?:1st|first)\s+(?:house|place|sector)\b/i},
  {id:'natal.partoffortune.position',pattern:/\bpart\s+of\s+fortune\b[^.]{0,160}(?:\d|°|\b(?:1st|2nd|3rd|4th|5th|6th|7th|8th|9th|10th|11th|12th|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth)\s+(?:house|place|sector)\b)/i},
];
for(const section of d.generated?.sections||[]){for(const block of section.blocks||[]){if(!Array.isArray(block.factIds))block.factIds=[];for(const rule of requirements){if(hasFact(rule.id)&&rule.pattern.test(String(block.prose||''))&&!block.factIds.map(String).includes(rule.id))block.factIds.push(rule.id);}}section.factsCited=(section.blocks||[]).flatMap(block=>(block.factIds||[]).map(String));section.prose=(section.blocks||[]).map(block=>String(block.prose||'')).join('\n\n');}
return [{json:d}];