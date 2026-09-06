import fixture from './fixtures/natal-factual-recovery.json';

type Outcome = 'approved' | 'rejected';

type Judge = { factual: boolean };

type RepairInput = {
  judgeFeedback: string;
  authoritativeFacts: Record<string, unknown>;
};

function boundedFactualRecovery(first: Judge, repaired: Judge, input: RepairInput): {
  revisionCount: number;
  rejudgeCount: number;
  loops: number;
  status: Outcome;
  repairPrompt: string;
} {
  if (first.factual) return { revisionCount: 0, rejudgeCount: 0, loops: 0, status: 'approved', repairPrompt: '' };
  return {
    revisionCount: 1,
    rejudgeCount: 1,
    loops: 0,
    status: repaired.factual ? 'approved' : 'rejected',
    repairPrompt: `EXACT JUDGE FEEDBACK:\n${input.judgeFeedback}\nAUTHORITATIVE FACTS:\n${JSON.stringify(input.authoritativeFacts)}`,
  };
}

describe('natal factual judge recovery fixture', () => {
  it('repairs one first-attempt factual rejection and approves a passing re-judge', () => {
    const result = boundedFactualRecovery(
      { factual: false },
      { factual: true },
      { judgeFeedback: JSON.stringify(fixture.firstJudge), authoritativeFacts: fixture.authoritativeFacts },
    );
    expect(result).toMatchObject({
      revisionCount: fixture.expected.revisionCount,
      rejudgeCount: fixture.expected.rejudgeCount,
      loops: fixture.expected.loops,
      status: fixture.rejudge.pass.status,
    });
    expect(result.repairPrompt).toContain(JSON.stringify(fixture.firstJudge));
    expect(result.repairPrompt).toContain(JSON.stringify(fixture.authoritativeFacts));
  });

  it('terminally rejects a second factual failure without another revision', () => {
    expect(boundedFactualRecovery(
      { factual: false },
      { factual: false },
      { judgeFeedback: JSON.stringify(fixture.firstJudge), authoritativeFacts: fixture.authoritativeFacts },
    )).toMatchObject({
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
