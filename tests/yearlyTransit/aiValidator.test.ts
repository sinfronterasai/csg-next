import { aiResponseToPipelineSections, validateYearlyTransitAiResponse } from '@/lib/yearlyTransit/aiValidator';
import { buildYearlyTransitAiBrief } from '@/lib/yearlyTransit/curation';
import { buildWorstCaseYearlyTransitPack } from './fixtures/worst-case-pack';
import { validateYearlyTransitCallback } from '@/lib/yearlyTransit/callback';

describe('yearly transit AI validator', () => {
  const pack = buildWorstCaseYearlyTransitPack();
  const brief = buildYearlyTransitAiBrief(pack);
  const validInterpretation = 'This period asks for a considered response in the life area named by the verified transit. Notice what is already asking for attention, then make practical adjustments that match your priorities. The exact-hit dates are checkpoints for reflection, conversation, and purposeful follow-through rather than guarantees about external events.';
  const base = () => ({
    schemaVersion: 'csg-yearly-transit-ai-v1', reportId: 'report-1', reportType: 'yearlytransit', versionBundle: pack.versionBundle,
    overallTheme: { id: 'theme', text: 'A grounded year-long theme connects the most important verified windows and invites deliberate choices.', evidenceIds: ['fact.window.0'] },
    primaryWindows: [],
    monthlyContext: brief.monthlyContext.map((month, index) => ({ id: `month-${index}`, monthKey: month.monthKey, summary: `This month brings the selected themes into clearer focus through ${month.primaryInfluences.map((item) => item.heading).join(', ') || 'integration and reflection'}. Keep attention on the curated priorities and use the month as a practical checkpoint.`, evidenceIds: month.evidenceIds.length ? month.evidenceIds : ['fact.window.0'] })),
    actions: Array.from({ length: 8 }, (_, index) => { const action = brief.actions[index] || brief.actions[0]; return { id: `action-${index}`, text: `${action.activePeriod}: use ${action.transit} to take ${['one concrete step', 'a review step', 'a communication step', 'a boundary-setting step', 'a follow-through step', 'a scheduling step', 'a documentation step', 'a conversation step'][index]} in ${action.lifeArea.toLowerCase()}, then review what the period is clarifying before adding new commitments.`, evidenceIds: action.evidenceIds.length ? action.evidenceIds : ['fact.window.0'] }; }),
    appendixSummary: { id: 'appendix', text: 'Supporting influences provide secondary context without replacing the priority of the main transit windows.', evidenceIds: ['fact.appendix'] },
  });

  it('accepts a complete curated response shape', () => {
    const response = validateYearlyTransitAiResponse(base(), pack, 'report-1');
    expect(response.monthlyContext).toHaveLength(12);
    expect(response.actions).toHaveLength(8);
    expect(aiResponseToPipelineSections(response)[0].id).toBe('theme');
    expect(validateYearlyTransitCallback({ status: 'approved', response }, pack, 'report-1')).toMatchObject({ status: 'approved' });
  });

  it.each([
    ['unknown evidence ID', (v: any) => { v.overallTheme.evidenceIds = ['missing']; }],
    ['wrong version', (v: any) => { v.versionBundle = { ...v.versionBundle, factPackVersion: 'wrong' }; }],
    ['extra top-level key', (v: any) => { v.extra = true; }],
    ['duplicate object ID', (v: any) => { v.appendixSummary.id = v.overallTheme.id; }],
    ['literal-event certainty', (v: any) => { v.overallTheme.text = 'You will receive an external event.'; }],
    ['internal score language', (v: any) => { v.overallTheme.text = 'importanceScore83 is not customer language.'; }],
    ['debug window language', (v: any) => { v.overallTheme.text = 'Yt Window should never appear.'; }],
    ['raw ISO timestamp', (v: any) => { v.overallTheme.text = 'The period begins 2027-05-04T09:42:46.000Z.'; }],
    ['raw monthly aspect dump', (v: any) => { v.monthlyContext[0].summary = 'A; B; C; D; E; F; G; H.'; }],
    ['one sentence month', (v: any) => { v.monthlyContext[0].summary = 'This month keeps Jupiter Conjunct Sun in focus for deliberate work and reflection.'; }],
    ['repeated action', (v: any) => { v.actions[1].text = v.actions[0].text; }],
    ['invented action date', (v: any) => { v.actions[0].text = 'December 25, 2099: make a choice.'; }],
    ['invented theme date', (v: any) => { v.overallTheme.text = 'The year begins on December 25, 2099 and asks for a grounded response.'; }],
  ])('rejects %s', (_label, mutate) => {
    const value = base(); mutate(value);
    expect(() => validateYearlyTransitAiResponse(value, pack, 'report-1')).toThrow(/invalid yearly-transit AI response/);
  });

  it('rejects generic primary timing boilerplate', () => {
    const value: any = base(); value.primaryWindows = [{ id: 'primary', title: 'Jupiter Conjunct Sun', interpretation: 'This relationship returns in 2 connected passes, creating a longer conversation rather than separate unrelated events. '.repeat(3), recommendations: ['One practical recommendation.', 'Another practical recommendation.'], evidenceIds: ['fact.window.0'] }];
    expect(() => validateYearlyTransitAiResponse(value, pack, 'report-1')).toThrow(/substantive interpretation/);
  });

  it.each([7, 13])('rejects an action plan with %s actions', (count) => {
    const value: any = base();
    value.actions = Array.from({ length: count }, (_, index) => ({ ...value.actions[index % 8], id: `different-${index}`, text: `${value.actions[index % 8].text} ${index}` }));
    expect(() => validateYearlyTransitAiResponse(value, pack, 'report-1')).toThrow(/actions count/);
  });
});
