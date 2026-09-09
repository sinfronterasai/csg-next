import type { PaidNatalPdfInput, PaidFact } from '@/lib/paidNatalPdf';

const signs = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
const signFor = (longitude: number) => signs[Math.floor(longitude / 30) % 12];

const placements: Array<[string, string, number, number | undefined, boolean?]> = [
  ['sun', 'Sun', 349 + 35 / 60, 7],
  ['moon', 'Moon', 259 + 50 / 60, 4],
  ['mercury', 'Mercury', 342 + 3 / 60, 7, true],
  ['venus', 'Venus', 33 + 37 / 60, 9],
  ['mars', 'Mars', 150 + 36 / 60, 1, true],
  ['jupiter', 'Jupiter', 153 + 27 / 60, 1, true],
  ['saturn', 'Saturn', 173 + 58 / 60, 2, true],
  ['uranus', 'Uranus', 235 + 31 / 60, 4, true],
  ['neptune', 'Neptune', 262 + 36 / 60, 4],
  ['pluto', 'Pluto', 201 + 12 / 60, 3, true],
  ['ascendant', 'Ascendant', 148 + 11 / 60, undefined],
  ['descendant', 'Descendant', 328 + 11 / 60, undefined],
  ['midheaven', 'Midheaven', 53 + 27 / 60, undefined],
  ['imumcoeli', 'Imum Coeli', 233 + 27 / 60, undefined],
];

const displayDegree = (longitude: number) => {
  const degree = Math.floor(longitude % 30);
  const minute = Math.round(((longitude % 30) - degree) * 60);
  return `${degree}deg${String(minute).padStart(2, '0')}`;
};

export const referencePositions: PaidFact[] = placements.map(([key, label, longitude, house, retrograde]) => {
  const signLabel = signFor(longitude);
  const display = `${label}${retrograde ? ' Rx' : ''} in ${signLabel} ${displayDegree(longitude)}${house ? ` - house ${house}` : ''}`;
  return {
    id: `natal.${key}.position`,
    kind: 'position',
    display,
    value: { key, label, longitude, signLabel, degreeInSign: longitude % 30, house, retrograde: Boolean(retrograde) },
  };
});

export const referenceHouses = Array.from({ length: 12 }, (_, index) => {
  const cuspLongitude = (148 + 11 / 60 + index * 30) % 360;
  return { num: index + 1, cuspLongitude, signLabel: signFor(cuspLongitude) };
});

const byKey = Object.fromEntries(referencePositions.map((fact) => [fact.value.key, fact]));
const aspect = (bodyA: string, bodyB: string, aspectType: string, orb: number, display: string): PaidFact => ({
  id: `aspect.${bodyA}.${aspectType}.${bodyB}`,
  kind: 'aspect',
  display,
  value: { bodyA, bodyB, aspectType, orb },
});

export const referenceAspects = [
  aspect('sun', 'moon', 'square', 0.25, 'Sun square Moon - orb 0deg15'),
  aspect('moon', 'neptune', 'conjunction', 2.77, 'Moon conjunct Neptune - orb 2deg46'),
  aspect('mars', 'jupiter', 'conjunction', 2.85, 'Mars conjunct Jupiter - orb 2deg51'),
  aspect('venus', 'jupiter', 'trine', 0.17, 'Venus trine Jupiter - orb 0deg10'),
];

const anchored = [byKey.sun, byKey.moon, byKey.venus, byKey.mars, byKey.jupiter] as PaidFact[];
const sections = [
  { heading: 'Your Natal Chart Story', body: `Your chart begins with [[${anchored[0].id}]] and [[${anchored[1].id}]]. This is the integration story: receive the vision, give it structure, and build lasting value.` },
  { heading: 'The Main Narrative: Your Unique Path', body: `Your path joins empathy with execution. [[${anchored[3].id}]] and [[${anchored[4].id}]] turn intuition into systems, useful craft, and steady service.` },
  { heading: 'The Foundation', body: 'Home is both sanctuary and launchpad. Emotional boundaries protect imagination so insight can become practical and durable.' },
  { heading: 'The Work', body: `Quality matters. [[${anchored[2].id}]] favors beauty, trust, consistency, education, and enduring value over empty speed.` },
  { heading: 'Your Ten Planetary Guides', body: 'Each placement offers a strength, an opportunity, and a challenge. The guides below translate verified positions into choices without treating symbolism as destiny.' },
  { heading: 'Strength and Opportunity', body: 'Pattern recognition becomes useful when paired with standards. Collaboration reveals capabilities; disciplined practice turns those capabilities into authority.' },
  { heading: 'Challenge and Integration', body: 'Perfection can delay action. Define what is good enough to test, release a real version, then refine from evidence rather than anxiety.' },
  { heading: 'Your Central Gifts', body: 'Intuitive pattern recognition. Practical refinement. Relational intelligence. Narrative depth. Quality-based leadership.' },
  { heading: 'Your Recurring Tensions', body: 'Closeness versus freedom. Vision versus perfection. Sensitivity versus boundaries. Usefulness versus worth. Stability versus reinvention.' },
  { heading: 'Practical Alignment Plan', body: 'For decisions, use a two-pass method: meaning first, then evidence, boundary, and next action. For work, build durable value. For relationships, state needs before adapting. For momentum, release version one before perfecting version ten.' },
  { heading: 'Closing Synthesis', body: 'You are not here to become less sensitive so that you can succeed. You are here to give sensitivity structure: imagination with standards, partnership with freedom, compassion with boundaries, and meaning with material form. END_OF_CLOSING_SYNTHESIS.' },
];

export const referenceFacts = Object.fromEntries([...referencePositions, ...referenceAspects].map((fact) => [fact.id, fact]));

export const referenceInput: PaidNatalPdfInput = {
  title: 'The Visionary Who Makes the Invisible Useful',
  name: 'Ethan',
  birth: { date: 'March 9, 1980', time: '4:21 PM', location: 'Santa Cruz, California' },
  facts: referenceFacts,
  ledger: {
    positions: referencePositions,
    houses: referenceHouses,
    aspects: referenceAspects,
    elements: { Fire: 2, Earth: 4, Air: 1, Water: 3 },
    modalities: { Mutable: 7, Fixed: 2, Cardinal: 1 },
  } as PaidNatalPdfInput['ledger'],
  sections,
};

export function overflowReferenceInput(): PaidNatalPdfInput {
  const tokens = Array.from({ length: 260 }, (_, index) => `PROSE_${String(index + 1).padStart(4, '0')}`);
  return {
    ...referenceInput,
    sections: referenceInput.sections.map((section, index) => ({
      ...section,
      body: `${section.body} ${tokens.slice(index * 23, index === referenceInput.sections.length - 1 ? undefined : (index + 1) * 23).join(' ')}${index === referenceInput.sections.length - 1 ? ' FINAL_INPUT_TOKEN' : ''}`,
    })),
  };
}
