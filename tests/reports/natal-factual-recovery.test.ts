import fixture from './fixtures/natal-factual-recovery.json';

type Outcome = 'approved' | 'rejected';

type Judge = { factual: boolean };

function boundedFactualRecovery(first: Judge, repaired: Judge): {
  revisionCount: number;
  rejudgeCount: number;
  loops: number;
  status: Outcome;
} {
  if (first.factual) return { revisionCount: 0, rejudgeCount: 0, loops: 0, status: 'approved' };
  return {
    revisionCount: 1,
    rejudgeCount: 1,
    loops: 0,
    status: repaired.factual ? 'approved' : 'rejected',
  };
}

describe('natal factual judge recovery fixture', () => {
  it('repairs one first-attempt factual rejection and approves a passing re-judge', () => {
    expect(boundedFactualRecovery({ factual: false }, { factual: true })).toEqual({
      revisionCount: fixture.expected.revisionCount,
      rejudgeCount: fixture.expected.rejudgeCount,
      loops: fixture.expected.loops,
      status: fixture.rejudge.pass.status,
    });
  });

  it('terminally rejects a second factual failure without another revision', () => {
    expect(boundedFactualRecovery({ factual: false }, { factual: false })).toEqual({
      revisionCount: 1,
      rejudgeCount: 1,
      loops: 0,
      status: fixture.rejudge.fail.status,
    });
  });

  it('fixture requires exact feedback and authoritative facts for the single repair', () => {
    expect(fixture.repair).toEqual({
      attempt: 2,
      usesExactJudgeFeedback: true,
      usesAuthoritativeFacts: true,
    });
  });
});
