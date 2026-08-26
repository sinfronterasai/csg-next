// A4 report-specific evidence bundles (R2-B4). Each bundle is a deterministic,
// fully-provenanced structure the writer cites. Fields built in later phases
// (transit windows, 12-month ledgers) are DECLARED and fail closed in preflight
// until their builder supplies them. Every bundle is surfaced as a stable
// VerifiedFact so the dangling-ID gate can validate all drivers.

import type {
  CommonDerived, RelationshipEvidence, LoveBlueprintEvidence, VocationEvidence, KarmicEvidence,
  AspectEvidence, VerifiedFact,
} from './types';

function aspectEvidence(common: CommonDerived, a: string, b: string): AspectEvidence {
  const hit = common.aspects.find(
    (x) => (x.value.bodyA === a && x.value.bodyB === b) || (x.value.bodyA === b && x.value.bodyB === a),
  );
  return {
    pair: `${a}-${b}`,
    aspectType: hit ? hit.value.aspectType : null,
    aspectId: hit ? hit.id : null,
    provenance: hit ? [hit.id] : [`natal.${a}.position`, `natal.${b}.position`],
  };
}

function occupantsOf(common: CommonDerived, house: number) {
  return common.occupants?.find((o) => o.house === house)?.occupants ?? [];
}

export function relationshipEvidence(common: CommonDerived): RelationshipEvidence {
  const dsc = common.rulers?.dsc;
  if (!dsc) throw new Error('relationship evidence requires 7th-house ruler (unknown-time chart)');
  return {
    seventhHouseRuler: dsc,
    seventhHouseOccupants: { house: 7, occupants: occupantsOf(common, 7) },
    aspects: {
      venusMars: aspectEvidence(common, 'venus', 'mars'),
      mercuryVenus: aspectEvidence(common, 'mercury', 'venus'),
      moonVenus: aspectEvidence(common, 'moon', 'venus'),
      venusSaturn: aspectEvidence(common, 'venus', 'saturn'),
    },
    junoCondition: common.juno.dignity ? `Juno ${common.juno.dignity}` : 'Juno neutral',
    scoreDrivers: [
      'score.relationship.emotionalStyle', 'score.relationship.desire',
      'score.relationship.communication', 'score.relationship.commitment', 'score.relationship.attachment',
    ],
  };
}

export function loveBlueprintEvidence(common: CommonDerived): LoveBlueprintEvidence {
  const dsc = common.rulers?.dsc;
  if (!dsc) throw new Error('love blueprint evidence requires 7th-house ruler');
  // F5-10: filter Chiron aspects to Venus/Moon ties only
  const chironAspects = common.aspects
    .filter((a) => (a.value.bodyA === 'chiron' || a.value.bodyB === 'chiron') &&
                   (a.value.bodyA === 'venus' || a.value.bodyB === 'venus' ||
                    a.value.bodyA === 'moon' || a.value.bodyB === 'moon'))
    .map((a) => a.id);
  return {
    aspects: {
      moonVenus: aspectEvidence(common, 'moon', 'venus'),
      venusMars: aspectEvidence(common, 'venus', 'mars'),
      junoSaturn: aspectEvidence(common, 'juno', 'saturn'),
    },
    dscRuler: dsc,
    dscOccupants: { house: 7, occupants: occupantsOf(common, 7) },
    chironAspects,
    // F5-4: explicit Chiron present/absent state
    chironEvidence: buildOptionalEvidence(
      chironAspects,
      'No qualifying Chiron-to-Venus-or-Moon tie was found in this chart',
    ),
    northNodeSign: common.northNode.sign,
    scoreDrivers: ['score.loveblueprint.archetype', 'score.relationship.emotionalStyle', 'score.relationship.desire'],
  };
}

export function vocationEvidence(common: CommonDerived): VocationEvidence {
  const tenth = common.rulers?.tenth; const second = common.rulers?.second; const sixth = common.rulers?.sixth;
  if (!tenth || !second || !sixth) throw new Error('vocation evidence requires 2nd/6th/10th rulers');
  // F5-9: complete MC package
  const mcFact = common.positions.find(p => p.id === 'natal.midheaven.position');
  const mcAspects = common.aspects
    .filter((a) => a.value.bodyA === 'midheaven' || a.value.bodyB === 'midheaven')
    .map((a) => a.id)
    .sort();
  return {
    mcRuler: tenth, secondRuler: second, sixthRuler: sixth,
    // F5-9: MC position metadata
    mcPositionId: 'natal.midheaven.position',
    mcSign: (mcFact?.value as any)?.sign || '',
    mcDegreeInSign: (mcFact?.value as any)?.degreeInSign || 0,
    mcAspects,
    // F4-7: aspects to the Midheaven / career axis (not Sun substitutes).
    saturnAspect: aspectEvidence(common, 'saturn', 'midheaven'),
    jupiterAspect: aspectEvidence(common, 'jupiter', 'midheaven'),
    plutoAspect: aspectEvidence(common, 'pluto', 'midheaven'),
    // F4-6/F5-ref2: wealth indicators are exactly the unique intended 2nd/6th/10th ruler-position facts.
    wealthIndicators: [...new Set([`natal.${second.ruler}.position`, `natal.${sixth.ruler}.position`, `natal.${tenth.ruler}.position`])],
    careerWindowsDeclared: false, // 24-month windows are P6/P7; declared + fail closed
  };
}

export function karmicEvidence(common: CommonDerived): KarmicEvidence {
  const northHouse = (common.northNode as any).house ?? null;
  const southHouse = (common.southNode as any).house ?? null;
  const nodal = common.nodalRulers;
  if (!nodal) throw new Error('karmic evidence requires nodal rulers');
  const nodalAspects = common.aspects.filter((a) => a.value.bodyA.includes('node') || a.value.bodyB.includes('node')).map((a) => a.id);
  const nodalSquares = common.aspects.filter((a) => a.value.aspectType === 'square' && (a.value.bodyA.includes('node') || a.value.bodyB.includes('node'))).map((a) => a.id);
  // F5-10: filter Chiron aspects to node ties only
  const chironAspects = common.aspects
    .filter((a) => (a.value.bodyA === 'chiron' || a.value.bodyB === 'chiron') &&
                   (a.value.bodyA.includes('node') || a.value.bodyB.includes('node')))
    .map((a) => a.id);
  return {
    northNodeHouse: northHouse, southNodeHouse: southHouse,
    northNodeRuler: nodal.north, southNodeRuler: nodal.south,
    nodalAspects, nodalSquares,
    saturnEvidence: aspectEvidence(common, 'saturn', 'sun'),
    plutoEvidence: aspectEvidence(common, 'pluto', 'sun'),
    chironAspects,
    // F5-4: explicit Chiron present/absent state
    chironEvidence: buildOptionalEvidence(
      chironAspects,
      'No qualifying Chiron-to-node tie was found in this chart',
    ),
  };
}

// F4-8: explicit optional-evidence state: present-with-citations or absent-with-reason.
function buildOptionalEvidence(ids: string[], absentReason: string): { present: boolean; ids: string[]; reason?: string } {
  if (ids.length > 0) return { present: true, ids };
  return { present: false, ids: [], reason: absentReason };
}

// Surface an evidence bundle as a stable VerifiedFact (kind 'score' is wrong here;
// use 'meta' so the dangling gate can still validate provenance/drivers).
export function evidenceFact(id: string, value: unknown, provenance: string[]): VerifiedFact {
  return {
    id, kind: 'meta', source: 'derived-deterministic',
    display: `${id} (${Array.isArray(provenance) ? provenance.length : 0} drivers)`,
    value, provenance,
  };
}
