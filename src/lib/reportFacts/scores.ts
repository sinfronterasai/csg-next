// Deterministic score + archetype engine for the relationship-family and
// vocation/karmic reports. All scores are 40-100 and every score carries explicit
// driver fact ids so the writer can show WHY a score exists. No prose, no invented
// psychology. Pure functions over CommonDerived.

import type { CommonDerived } from './types';

export interface ScoreBand {
  score: number; // 40-100
  drivers: string[]; // fact ids that produced it
}

export interface RelationshipScores {
  emotionalConnection: ScoreBand;
  passion: ScoreBand;
  communication: ScoreBand;
  stability: ScoreBand;
  growth: ScoreBand;
}

function aspectBetween(common: CommonDerived, a: string, b: string): string | null {
  const hit = common.aspects.find((x) => (x.value.bodyA === a && x.value.bodyB === b) || (x.value.bodyA === b && x.value.bodyB === a));
  return hit ? hit.id : null;
}

// relationship: five deterministic dimensions with traceable drivers.
export function relationshipScores(common: CommonDerived): RelationshipScores {
  const venusMars = aspectBetween(common, 'venus', 'mars');
  const mercuryVenus = aspectBetween(common, 'mercury', 'venus');
  const venusSaturn = aspectBetween(common, 'venus', 'saturn');
  const moonVenus = aspectBetween(common, 'moon', 'venus');
  const sunVenus = aspectBetween(common, 'sun', 'venus');
  const moonMars = aspectBetween(common, 'moon', 'mars');
  const mercuryMars = aspectBetween(common, 'mercury', 'mars');
  const sunSaturn = aspectBetween(common, 'sun', 'saturn');
  const moonSaturn = aspectBetween(common, 'moon', 'saturn');

  const drivers = (...ids: (string | null)[]) => ids.filter(Boolean) as string[];
  const base = 60;

  const emotionalConnection: ScoreBand = {
    score: clamp(base + (moonVenus ? 14 : 0) + (venusMars ? 6 : 0) + (sunVenus ? 6 : 0)),
    drivers: drivers(moonVenus, venusMars, sunVenus, 'common.moonPhase'),
  };
  const passion: ScoreBand = {
    score: clamp(base + (venusMars ? 18 : 0) + (moonMars ? 8 : 0)),
    drivers: drivers(venusMars, moonMars),
  };
  const communication: ScoreBand = {
    score: clamp(base + (mercuryVenus ? 16 : 0) + (mercuryMars ? 8 : 0)),
    drivers: drivers(mercuryVenus, mercuryMars),
  };
  const stability: ScoreBand = {
    score: clamp(base + (venusSaturn ? 10 : 0) + (sunSaturn ? 6 : 0) + (moonSaturn ? 6 : 0) - (venusSaturn ? 0 : 0)),
    drivers: drivers(venusSaturn, sunSaturn, moonSaturn),
  };
  const growth: ScoreBand = {
    score: clamp(base + (sunVenus ? 8 : 0) + (moonVenus ? 6 : 0) + (venusMars ? 6 : 0)),
    drivers: drivers(sunVenus, moonVenus, venusMars),
  };
  return { emotionalConnection, passion, communication, stability, growth };
}

// Love Blueprint: deterministic archetype code + drivers.
export function loveBlueprintArchetype(common: CommonDerived): { code: string; drivers: string[] } {
  const venusMars = aspectBetween(common, 'venus', 'mars');
  const mercuryVenus = aspectBetween(common, 'mercury', 'venus');
  const venusSaturn = aspectBetween(common, 'venus', 'saturn');
  const moonVenus = aspectBetween(common, 'moon', 'venus');
  const uranusVenus = aspectBetween(common, 'uranus', 'venus');
  let code = 'Steadfast Devotee';
  const drivers: string[] = [];
  if (venusMars && uranusVenus) { code = 'Electric Pioneer'; drivers.push(venusMars, uranusVenus); }
  else if (venusMars && mercuryVenus) { code = 'Sensual Communicator'; drivers.push(venusMars, mercuryVenus); }
  else if (venusSaturn && moonVenus) { code = 'Loyal Anchor'; drivers.push(venusSaturn, moonVenus); }
  else if (moonVenus) { code = 'Tender Romantic'; drivers.push(moonVenus); }
  else { drivers.push('common.chartRuler'); }
  return { code, drivers };
}

// Vocation: deterministic archetype + drivers from career-axis evidence.
export function vocationArchetype(common: CommonDerived): { code: string; drivers: string[] } {
  const saturn = aspectBetween(common, 'saturn', 'sun') || aspectBetween(common, 'saturn', 'midheaven') ;
  const jupiter = aspectBetween(common, 'jupiter', 'sun') || aspectBetween(common, 'jupiter', 'midheaven');
  const pluto = aspectBetween(common, 'pluto', 'sun') || aspectBetween(common, 'pluto', 'midheaven');
  const mercury = aspectBetween(common, 'mercury', 'sun') || aspectBetween(common, 'mercury', 'midheaven');
  let code = 'Purposeful Builder';
  const drivers: string[] = [];
  if (pluto && saturn) { code = 'Transformational Architect'; drivers.push(pluto, saturn); }
  else if (jupiter && mercury) { code = 'Expansive Messenger'; drivers.push(jupiter, mercury); }
  else if (saturn) { code = 'Disciplined Craftsperson'; drivers.push(saturn); }
  else { drivers.push('common.chartRuler', 'common.midheaven.position'); }
  return { code, drivers };
}

// Karmic: nodal axis relevance + squares + Chiron ties.
export function karmicScores(common: CommonDerived): { axis: string; drivers: string[]; hasSquares: boolean } {
  const nodeSq = common.aspects.filter((a) => a.value.aspectType === 'square' && (a.value.bodyA.includes('node') || a.value.bodyB.includes('node'))).map((a) => a.id);
  const chiron = common.aspects.filter((a) => a.value.bodyA === 'chiron' || a.value.bodyB === 'chiron').map((a) => a.id);
  const drivers = ['common.northNode', 'common.southNode', ...nodeSq, ...chiron];
  return { axis: `${common.northNode.signLabel} / ${common.southNode.signLabel}`, drivers, hasSquares: nodeSq.length > 0 };
}

function clamp(n: number): number {
  return Math.max(40, Math.min(100, Math.round(n)));
}
