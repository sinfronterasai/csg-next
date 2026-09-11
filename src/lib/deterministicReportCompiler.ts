import type { PositionValue, VerifiedFact, VerifiedFactsV2, AspectFact, PatternFact } from './reportFacts/types';

const BODY_ORDER = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'chiron', 'juno'] as const;
type FactRef = { id: string; label: string; display: string };
export type NarrativeSlot = { id: string; role: string; wordLimit: { min: number; max: number }; relevantFactIds: string[] };
export type PlanetRow = { key: string; body: string; sign: string; degree: string; house: string; retrograde: string; dignity: string };
export type AspectRow = { id: string; bodyA: string; bodyB: string; aspect: string; orb: string; display: string };
export type HouseRow = { house: number; sign: string; cusp: string; display: string };
export type PatternRow = { id: string; name: string; participants: string[]; tightness: string; display: string };
export type PremiumNatalCompilation = {
  schemaVersion: 'csg-premium-natal-compiled-v1';
  metadata: { reportType: 'natal'; asOfDate: string; solarFallback: boolean };
  facts: FactRef[];
  tables: { planets: PlanetRow[]; aspects: AspectRow[]; houses: HouseRow[]; patterns: PatternRow[] };
  narrativeSlots: NarrativeSlot[];
};
export type NarrativePrompt = { sectionId: string; role: string; wordLimit: { min: number; max: number }; facts: FactRef[] };
export type NarrativeFactPack = { sectionId: string; role: string; wordLimit: { min: number; max: number }; facts: FactRef[] };

function fail(message: string): never { throw new Error(`deterministic report compilation failed: ${message}`); }
function asPosition(fact: VerifiedFact): PositionValue {
  if (!fact || fact.kind !== 'position' || fact.source !== 'swiss-ephemeris' || !fact.id || !fact.display?.trim()) fail('invalid position fact');
  const value = fact.value as PositionValue;
  if (!value || typeof value !== 'object' || value.key !== fact.id.slice(6, -9) || !value.label || !value.sign || !value.signLabel) fail(`invalid position ${fact.id}`);
  if (!Number.isFinite(value.degreeInSign) || value.degreeInSign < 0 || value.degreeInSign >= 30) fail(`invalid degree for ${fact.id}`);
  if (!Number.isFinite(value.longitude) || value.longitude < 0 || value.longitude >= 360) fail(`invalid longitude for ${fact.id}`);
  if (value.house !== null && (!Number.isInteger(value.house) || value.house < 1 || value.house > 12)) fail(`invalid house for ${fact.id}`);
  if (typeof value.retrograde !== 'boolean' || !['domicile', 'exaltation', 'detriment', 'fall', null].includes(value.dignity)) fail(`invalid position ${fact.id}`);
  return value;
}
function positionMap(ledger: VerifiedFactsV2): Map<string, VerifiedFact> {
  if (!ledger || ledger.schemaVersion !== 'csg-report-facts-v2' || ledger.reportType !== 'natal' || !ledger.asOfDate) fail('missing or invalid ledger');
  if (!Array.isArray(ledger.common?.positions) || !ledger.facts || typeof ledger.facts !== 'object') fail('positions/facts are required');
  const map = new Map<string, VerifiedFact>();
  for (const fact of ledger.common.positions) {
    const value = asPosition(fact);
    const authority = ledger.facts[fact.id];
    if (fact.id !== `natal.${value.key}.position` || !authority || authority.id !== fact.id || authority.kind !== fact.kind || authority.source !== fact.source || authority.display !== fact.display || JSON.stringify(authority.value) !== JSON.stringify(fact.value)) fail(`position ${fact.id} is not ledger authority`);
    if (map.has(value.key)) fail(`duplicate position ${value.key}`);
    map.set(value.key, fact);
  }
  for (const key of BODY_ORDER) if (!map.has(key)) fail(`missing position ${key}`);
  return map;
}
function ref(fact: VerifiedFact): FactRef { return { id: fact.id, label: (fact.value as any).label ?? fact.id, display: fact.display }; }
function allFacts(ledger: VerifiedFactsV2, ids: string[]): FactRef[] {
  return ids.map((id) => { const fact = ledger.facts[id]; if (!fact || typeof fact.display !== 'string' || !fact.display.trim()) fail(`missing narrative fact ${id}`); return ref(fact); });
}

export function compilePremiumNatalReport(ledger: VerifiedFactsV2): PremiumNatalCompilation {
  const positions = positionMap(ledger);
  const planets = BODY_ORDER.map((key) => { const value = positions.get(key)!.value as PositionValue; return { key, body: value.label, sign: value.signLabel, degree: `${value.degreeInSign}°`, house: value.house === null ? '—' : String(value.house), retrograde: value.retrograde ? 'Retrograde' : 'Direct', dignity: value.dignity ?? '—' }; });
  const aspects = (ledger.common.aspects ?? []).map((fact) => { const value = (fact as AspectFact).value; if (!ledger.facts[fact.id] || fact.source !== 'derived-deterministic') fail(`invalid aspect ${fact.id}`); return { id: fact.id, bodyA: value.bodyA, bodyB: value.bodyB, aspect: value.aspectType, orb: `${value.orb}°`, display: fact.display }; });
  const houses = (ledger.common.houses ?? []).map((house) => ({ house: house.num, sign: house.signLabel, cusp: `${house.cuspLongitude}°`, display: `House ${house.num} cusp ${house.signLabel}` }));
  const patterns = (ledger.common.patterns ?? []).map((fact) => { const value = (fact as PatternFact).value; if (!ledger.facts[fact.id]) fail(`invalid pattern ${fact.id}`); return { id: fact.id, name: value.name, participants: [...value.participants], tightness: `${value.tightness}°`, display: fact.display }; });
  const slots: Array<[string, string, { min: number; max: number }, string[]]> = [
    ['identity', 'warm interpreter', { min: 90, max: 140 }, ['natal.sun.position']],
    ['inner-world', 'warm interpreter', { min: 90, max: 140 }, ['natal.moon.position']],
    ['integration', 'practical guide', { min: 110, max: 170 }, ['natal.mercury.position', 'natal.venus.position', 'natal.mars.position']],
    ['dynamics', 'pattern interpreter', { min: 100, max: 160 }, aspects.slice(0, 3).map((a) => a.id)],
  ];
  const narrativeSlots = slots.map(([id, role, wordLimit, ids]) => ({ id, role, wordLimit, relevantFactIds: ids }));
  const facts = [...planets.map((row) => ({ id: `natal.${row.key}.position`, label: row.body, display: `${row.body} — ${row.degree} ${row.sign} — House ${row.house}` })), ...aspects.map((a) => ({ id: a.id, label: a.aspect, display: a.display }))];
  return { schemaVersion: 'csg-premium-natal-compiled-v1', metadata: { reportType: 'natal', asOfDate: ledger.asOfDate, solarFallback: ledger.common.isSolarFallback }, facts, tables: { planets, aspects, houses, patterns }, narrativeSlots };
}

export function buildNarrativePrompt(compiled: PremiumNatalCompilation, sectionId: string, modelFields?: Record<string, unknown>): NarrativePrompt {
  if (modelFields && Object.keys(modelFields).length) fail('LLM input cannot contain factual fields');
  const slot = compiled.narrativeSlots.find((candidate) => candidate.id === sectionId); if (!slot) fail(`unknown narrative section ${sectionId}`);
  const facts = allFactsFromCompiled(compiled, slot.relevantFactIds);
  return { sectionId: slot.id, role: slot.role, wordLimit: slot.wordLimit, facts };
}
function allFactsFromCompiled(compiled: PremiumNatalCompilation, ids: string[]): FactRef[] {
  return ids.map((id) => { const fact = compiled.facts.find((candidate) => candidate.id === id); if (!fact) fail(`unsupported narrative fact ${id}`); return { ...fact }; });
}
export function buildNarrativeFactPacks(compiled: PremiumNatalCompilation): NarrativeFactPack[] {
  return compiled.narrativeSlots.map((slot) => ({ sectionId: slot.id, role: slot.role, wordLimit: slot.wordLimit, facts: allFactsFromCompiled(compiled, slot.relevantFactIds) }));
}
