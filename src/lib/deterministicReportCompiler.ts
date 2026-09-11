import type { PositionValue, VerifiedFact, VerifiedFactsV2 } from './reportFacts/types';

const BODY_ORDER = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'] as const;
const SLOT_DEFS = [
  { id: 'identity', role: 'warm interpreter', wordLimit: { min: 90, max: 140 }, keys: ['sun'] },
  { id: 'inner-world', role: 'warm interpreter', wordLimit: { min: 90, max: 140 }, keys: ['moon'] },
  { id: 'integration', role: 'practical guide', wordLimit: { min: 110, max: 170 }, keys: ['mercury', 'venus', 'mars'] },
] as const;

type BodyRow = { body: string; sign: string; degree: string; house: string; retrograde: string; dignity: string };
export type NarrativeSlot = {
  id: string;
  role: string;
  relevantFactIds: string[];
  wordLimit: { min: number; max: number };
};
export type PremiumNatalCompilation = {
  schemaVersion: 'csg-premium-natal-compiled-v1';
  tables: { planets: BodyRow[] };
  narrativeSlots: NarrativeSlot[];
};
export type NarrativePrompt = {
  sectionId: string;
  role: string;
  wordLimit: { min: number; max: number };
  facts: Array<{ label: string; display: string }>;
};

function fail(message: string): never { throw new Error(`deterministic report compilation failed: ${message}`); }
function asPosition(fact: VerifiedFact): PositionValue {
  if (!fact || fact.kind !== 'position' || fact.source !== 'swiss-ephemeris' || !fact.id || !fact.display.trim()) fail('invalid position fact');
  const value = fact.value as PositionValue;
  if (!value || typeof value !== 'object' || typeof value.key !== 'string' || !value.key || typeof value.label !== 'string' || !value.label || typeof value.sign !== 'string' || !value.sign || typeof value.signLabel !== 'string' || !value.signLabel) fail(`invalid position ${fact.id}`);
  if (!Number.isFinite(value.degreeInSign) || value.degreeInSign < 0 || value.degreeInSign >= 30) fail(`invalid degree for ${fact.id}`);
  if (!Number.isFinite(value.longitude) || value.longitude < 0 || value.longitude >= 360) fail(`invalid longitude for ${fact.id}`);
  if (!Number.isInteger(value.house) && value.house !== null) fail(`invalid house for ${fact.id}`);
  if (value.house !== null && (value.house < 1 || value.house > 12)) fail(`invalid house for ${fact.id}`);
  if (typeof value.retrograde !== 'boolean') fail(`invalid retrograde for ${fact.id}`);
  if (!['domicile', 'exaltation', 'detriment', 'fall', null].includes(value.dignity)) fail(`invalid dignity for ${fact.id}`);
  return value;
}

function positionMap(ledger: VerifiedFactsV2): Map<string, VerifiedFact> {
  if (ledger.schemaVersion !== 'csg-report-facts-v2' || ledger.reportType !== 'natal') fail('wrong ledger contract');
  if (!Array.isArray(ledger.common?.positions)) fail('positions are required');
  const map = new Map<string, VerifiedFact>();
  for (const fact of ledger.common.positions) {
    const value = asPosition(fact);
    if (map.has(value.key)) fail(`duplicate position ${value.key}`);
    if (fact.id !== `natal.${value.key}.position`) fail(`non-canonical position id ${fact.id}`);
    map.set(value.key, fact);
  }
  for (const key of BODY_ORDER) if (!map.has(key)) fail(`missing position ${key}`);
  return map;
}

export function compilePremiumNatalReport(ledger: VerifiedFactsV2): PremiumNatalCompilation {
  const positions = positionMap(ledger);
  const planets = BODY_ORDER.map((key) => {
    const fact = positions.get(key)!;
    const value = fact.value as PositionValue;
    return {
      body: value.label,
      sign: value.signLabel,
      degree: `${value.degreeInSign}°`,
      house: value.house === null ? '—' : String(value.house),
      retrograde: value.retrograde ? 'Retrograde' : 'Direct',
      dignity: value.dignity === null ? '—' : value.dignity,
    };
  });
  const narrativeSlots = SLOT_DEFS.map(({ id, role, wordLimit, keys }) => ({
    id, role, wordLimit,
    relevantFactIds: keys.map((key) => positions.get(key)!.id),
  }));
  return { schemaVersion: 'csg-premium-natal-compiled-v1', tables: { planets }, narrativeSlots };
}

export function buildNarrativePrompt(
  compiled: PremiumNatalCompilation,
  sectionId: string,
  modelFields?: Record<string, unknown>,
): NarrativePrompt {
  if (modelFields && Object.keys(modelFields).length) fail('LLM input cannot contain factual fields');
  const slot = compiled.narrativeSlots.find((candidate) => candidate.id === sectionId);
  if (!slot) fail(`unknown narrative section ${sectionId}`);
  const ids = new Set(slot.relevantFactIds);
  const index = new Map(BODY_ORDER.map((key, i) => [`natal.${key}.position`, compiled.tables.planets[i]]));
  const facts = slot.relevantFactIds.map((id) => {
    if (!ids.has(id) || !index.has(id)) fail(`unsupported narrative fact ${id}`);
    const row = index.get(id)!;
    return { label: row.body, display: `${row.body} — ${row.degree} ${row.sign} — House ${row.house}` };
  });
  return { sectionId: slot.id, role: slot.role, wordLimit: slot.wordLimit, facts };
}
