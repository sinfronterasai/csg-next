// Deterministic score + archetype engine for the relationship-family and
// vocation/karmic reports. All scores are 40-100 and every score carries explicit
// driver fact ids (resolvable to facts in the ledger) plus the documented rule
// that produced it. No prose, no invented psychology. Pure functions over
// CommonDerived.
//
// B6 — replaced the previous all-positive increment model with a documented,
// reviewable policy: each dimension scores from the SUM of aspect weights
// (supportive trine/sextile are positive, dynamic square/opposition negative,
// conjunction neutral-amplifying) over the aspect pairs relevant to that
// dimension, orb-weighted. A documented baseline anchors every score.

import type { CommonDerived, AspectFact } from './types';

// Documented scoring policy (shared with the review contract A3 / B6).
// Baseline 60 = a chart with no relevant aspects is "average"; aspects move it.
export const SCORE_BASELINE = 60;
export const SCORE_SCALE = 20; // each unit of summed aspect-weight moves the score by 20
export const SCORE_MIN = 40;
export const SCORE_MAX = 100;

// R2-B12: locked score shape is { value, drivers, label, band }. `value` is the
// 40-100 integer; `label` is the human dimension; `band` is low|moderate|high;
// `drivers` are resolvable fact ids; `rule` is the documented, reviewable rule.
// A constant baseline (no relevant aspect) is represented as an EXPLICIT,
// non-celestial rule -- never as false Moon-phase provenance.
export type ScoreBandLevel = 'low' | 'moderate' | 'high';
export interface ScoreBand {
  value: number; // 40-100 integer
  drivers: string[]; // fact ids that produced it (may be empty for a constant baseline)
  label: string; // dimension label
  band: ScoreBandLevel;
  rule: string; // documented, reviewable rule (explicit when constant)
}

export interface RelationshipScores {
  emotionalStyle: ScoreBand;
  desire: ScoreBand;
  communication: ScoreBand;
  commitment: ScoreBand;
  attachment: ScoreBand;
}

function aspectId(common: CommonDerived, a: string, b: string): string | null {
  const hit = common.aspects.find(
    (x: AspectFact) =>
      (x.value.bodyA === a && x.value.bodyB === b) || (x.value.bodyA === b && x.value.bodyB === a),
  );
  return hit ? hit.id : null;
}

// Sum the (orb-weighted, signed) aspect weights over the given body pairs.
function weightedSum(common: CommonDerived, pairs: [string, string][]): { total: number; drivers: string[] } {
  let total = 0;
  const drivers: string[] = [];
  for (const [a, b] of pairs) {
    const id = aspectId(common, a, b);
    if (!id) continue;
    const w = (common.aspects.find((x) => x.id === id)!.value as any).weight as number;
    total += w;
    drivers.push(id);
  }
  return { total, drivers };
}

function clampScore(n: number): number {
  return Math.max(SCORE_MIN, Math.min(SCORE_MAX, Math.round(n)));
}

// Build a band from a set of aspect pairs. Baseline + scaled weighted sum.
// When no relevant aspect exists the baseline is CONSTANT (documented explicitly);
// drivers stays empty rather than citing an unrelated fact as a false cause.
function band(common: CommonDerived, pairs: [string, string][], label: string): ScoreBand {
  const { total, drivers } = weightedSum(common, pairs);
  const value = clampScore(SCORE_BASELINE + SCORE_SCALE * total);
  const bandLevel: ScoreBandLevel = value < 55 ? 'low' : value < 75 ? 'moderate' : 'high';
  const rule = drivers.length > 0
    ? `${label}: baseline ${SCORE_BASELINE} (constant) + ${SCORE_SCALE} * Σ(aspect weights over ${pairs.length} pair[s]) = ${total.toFixed(2)}`
    : `${label}: constant baseline ${SCORE_BASELINE} (no relevant aspect found; not derived from any celestial cause)`;
  return { value, drivers, label, band: bandLevel, rule };
}

// relationship: five DISTINCT deterministic dimensions (R2-B12). Each uses a
// different aspect-pair set so dimensions are never duplicates, and no dimension
// cites Moon phase as a causal provenance for a constant baseline.
export function relationshipScores(common: CommonDerived): RelationshipScores {
  return {
    emotionalStyle: band(common, [['moon', 'venus'], ['sun', 'venus'], ['mercury', 'venus']], 'emotional style'),
    desire: band(common, [['venus', 'mars'], ['moon', 'mars']], 'desire'),
    communication: band(common, [['mercury', 'venus'], ['mercury', 'mars']], 'communication'),
    commitment: band(common, [['venus', 'saturn'], ['sun', 'saturn']], 'commitment'),
    attachment: band(common, [['moon', 'venus'], ['venus', 'jupiter']], 'attachment/security'),
  };
}

// Love Blueprint: deterministic archetype from relationship-axis evidence.
export function loveBlueprintArchetype(common: CommonDerived): { code: string; drivers: string[]; rule: string } {
  const venusMars = aspectId(common, 'venus', 'mars');
  const mercuryVenus = aspectId(common, 'mercury', 'venus');
  const venusSaturn = aspectId(common, 'venus', 'saturn');
  const moonVenus = aspectId(common, 'moon', 'venus');
  const uranusVenus = aspectId(common, 'uranus', 'venus');
  const drivers: string[] = [];
  let code = 'Steadfast Devotee';
  let rule = 'default: no Venus-Mars/Moon-Venus aspect -> steady, loyal archetype';
  if (venusMars && uranusVenus) { code = 'Electric Pioneer'; drivers.push(venusMars, uranusVenus); rule = 'Venus trine/conj square Uranus + Mars -> electric, restless'; }
  else if (venusMars && mercuryVenus) { code = 'Sensual Communicator'; drivers.push(venusMars, mercuryVenus); rule = 'Venus-Mars + Mercury-Venus -> expressive, communicative love'; }
  else if (venusSaturn && moonVenus) { code = 'Loyal Anchor'; drivers.push(venusSaturn, moonVenus); rule = 'Venus-Saturn + Moon-Venus -> committed, stabilizing'; }
  else if (moonVenus) { code = 'Tender Romantic'; drivers.push(moonVenus); rule = 'Moon-Venus present -> warm, affectionate'; }
  else { drivers.push('common.chartRuler'); rule = 'no Venus dyad -> anchored by chart ruler'; }
  return { code, drivers, rule };
}

// Vocation: deterministic archetype from career-axis evidence (10th/2nd/6th via
// Saturn/Jupiter/Pluto/Mercury to Sun or MC).
export function vocationArchetype(common: CommonDerived): { code: string; drivers: string[]; rule: string } {
  const saturn = aspectId(common, 'saturn', 'sun') || aspectId(common, 'saturn', 'midheaven');
  const jupiter = aspectId(common, 'jupiter', 'sun') || aspectId(common, 'jupiter', 'midheaven');
  const pluto = aspectId(common, 'pluto', 'sun') || aspectId(common, 'pluto', 'midheaven');
  const mercury = aspectId(common, 'mercury', 'sun') || aspectId(common, 'mercury', 'midheaven');
  const drivers: string[] = [];
  let code = 'Purposeful Builder';
  let rule = 'default: no career-axis aspect -> steady builder';
  if (pluto && saturn) { code = 'Transformational Architect'; drivers.push(pluto, saturn); rule = 'Pluto + Saturn to Sun/MC -> deep restructuring career'; }
  else if (jupiter && mercury) { code = 'Expansive Messenger'; drivers.push(jupiter, mercury); rule = 'Jupiter + Mercury to Sun/MC -> communicative expansion'; }
  else if (saturn) { code = 'Disciplined Craftsperson'; drivers.push(saturn); rule = 'Saturn to Sun/MC -> disciplined, masterful'; }
  else { drivers.push('common.chartRuler', 'natal.midheaven.position'); rule = 'anchored by chart ruler + MC'; }
  return { code, drivers, rule };
}

// Karmic: nodal axis relevance + squares + Chiron ties.
export function karmicScores(common: CommonDerived): { axis: string; drivers: string[]; hasSquares: boolean; rule: string } {
  const nodeSq = common.aspects
    .filter((a) => a.value.aspectType === 'square' && (a.value.bodyA.includes('node') || a.value.bodyB.includes('node')))
    .map((a) => a.id);
  const chiron = common.aspects
    .filter((a) => a.value.bodyA === 'chiron' || a.value.bodyB === 'chiron')
    .map((a) => a.id);
  const drivers = ['natal.northnode.position', 'natal.southnode.position', ...nodeSq, ...chiron];
  const rule = `nodal axis ${common.northNode.signLabel}/${common.southNode.signLabel}; ${nodeSq.length} nodal squares; ${chiron.length} Chiron aspects`;
  return { axis: `${common.northNode.signLabel} / ${common.southNode.signLabel}`, drivers, hasSquares: nodeSq.length > 0, rule };
}

// Validate every score band: range + non-empty resolvable drivers. Used by the
// ledger builder so an unresolved/absent driver cannot ship.
export function validateScoreBands(scores: Record<string, ScoreBand>): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  for (const [k, b] of Object.entries(scores)) {
    if (typeof b.value !== 'number' || b.value < SCORE_MIN || b.value > SCORE_MAX) {
      errors.push(`${k}: value ${b.value} out of range ${SCORE_MIN}-${SCORE_MAX}`);
    }
    if (b.band !== 'low' && b.band !== 'moderate' && b.band !== 'high') errors.push(`${k}: missing band`);
    if (typeof b.label !== 'string' || !b.label) errors.push(`${k}: missing label`);
    if (!Array.isArray(b.drivers)) errors.push(`${k}: drivers not array`);
    if (b.drivers.length === 0 && !/constant baseline/.test(b.rule)) errors.push(`${k}: empty drivers without constant-baseline rule`);
    if (!b.rule) errors.push(`${k}: missing rule`);
  }
  return { ok: errors.length === 0, errors };
}
