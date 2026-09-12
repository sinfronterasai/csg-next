const d=$input.first().json;
const ids=(d.generated?.sections||[]).map(s=>String(s.id)).filter(Boolean);
const cited=[...new Set((d.generated?.sections||[]).flatMap(s=>Array.isArray(s.factsCited)?s.factsCited.map(String):[]))];
const rawFacts=d.verifiedFacts?.facts||{};
const factSubset={};
if(Array.isArray(rawFacts)){for(const fact of rawFacts){if(fact&&cited.includes(String(fact.id)))factSubset[String(fact.id)]=fact;}}
else {for(const id of cited){if(rawFacts[id])factSubset[id]=rawFacts[id];}}
const rubric={hardGates:['factual','banned','specific','dup','tone','structure','length','ageConsent'],scores:['precision','insightDensity','voiceFit','empowerment','personalization','clarity','cohesion'],issueCategories:['factual','structure','specificity','narrative','tone','duplication','length','safety']};
const aiPrompt=`Independently judge the report against ONLY the authoritative cited facts. Return ONLY strict JSON with this exact shape: {"hardGates":{"factual":true,"banned":true,"specific":true,"dup":true,"tone":true,"structure":true,"length":true,"ageConsent":true},"scores":{"precision":1,"insightDensity":1,"voiceFit":1,"empowerment":1,"personalization":1,"clarity":1,"cohesion":1},"verdict":"pass|revise|reject","failedSections":[],"issues":[{"section":"exact section ID","category":"factual|structure|specificity|narrative|tone|duplication|length|safety","repairable":true,"problem":"short exact problem","requiredFix":"specific correction","factIds":["exact authoritative fact ID"]}],"flags":[],"notes":"short reason"}.
Rules: factual claims must be explicitly supported by FACTS. Never approve a plausible but absent aspect, placement, orb, ruler, house, or pattern. For every failing hard gate, return each affected exact section in failedSections and one actionable issue. Use only allowed section IDs and exact fact IDs. Mark repairable true only when replacing that section using FACTS can fix it. Free requires all scores >=3; paid requires >=4.
ALLOWED SECTION IDS:${JSON.stringify(ids)}
RUBRIC:${JSON.stringify(rubric)}
CITED FACTS:${JSON.stringify(factSubset)}
REPORT:${JSON.stringify(d.generated)}`;
if(aiPrompt.length>90000)throw new Error('Bounded judge prompt unexpectedly exceeds 90000 characters');
return [{json:{...d,aiPrompt,judgeFactIds:cited,judgeFactCount:Object.keys(factSubset).length}}];