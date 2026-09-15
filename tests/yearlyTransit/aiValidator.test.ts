import { aiResponseToPipelineSections, validateYearlyTransitAiResponse } from '@/lib/yearlyTransit/aiValidator';
import { buildWorstCaseYearlyTransitPack } from './fixtures/worst-case-pack';
import { validateYearlyTransitCallback } from '@/lib/yearlyTransit/callback';

describe('yearly transit AI validator', () => {
  const pack = buildWorstCaseYearlyTransitPack();
  const base = () => ({ schemaVersion: 'csg-yearly-transit-ai-v1', reportId: 'report-1', reportType: 'yearlytransit', versionBundle: pack.versionBundle,
    overallTheme: { id: 'theme', text: 'A grounded theme.', evidenceIds: ['fact.window.0'] }, primaryWindows: [], monthlyContext: [], actions: [], appendixSummary: { id: 'appendix', text: 'Evidence remains available for reflection.', evidenceIds: ['fact.appendix'] } });

  it('accepts the exact bounded response shape', () => {
    const response = validateYearlyTransitAiResponse(base(), pack, 'report-1');
    expect(response.reportType).toBe('yearlytransit');
    expect(aiResponseToPipelineSections(response)[0]).toEqual({ id: 'theme', prose: 'A grounded theme.', blocks: [{ role: 'synthesis', prose: 'A grounded theme.', factIds: ['fact.window.0'] }] });
    const callback = validateYearlyTransitCallback({ status: 'approved', response }, pack, 'report-1');
    expect(callback.status).toBe('approved');
    if (callback.status !== 'approved') throw new Error('expected approved callback');
    expect(callback.response.reportId).toBe('report-1');
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
  ])('rejects %s', (_label, mutate) => {
    const value = base(); mutate(value);
    expect(() => validateYearlyTransitAiResponse(value, pack, 'report-1')).toThrow(/invalid yearly-transit AI response/);
  });

  it('rejects overlong bounded blocks and more than eight primary windows', () => {
    const value: any = base(); value.overallTheme.text = 'x'.repeat(2001);
    expect(() => validateYearlyTransitAiResponse(value, pack, 'report-1')).toThrow(/2000/);
    const many = base() as any; many.primaryWindows = Array.from({ length: 9 }, (_, i) => ({ id: `p${i}`, title: 't', interpretation: 'i', recommendations: [], evidenceIds: ['fact.window.0'] }));
    expect(() => validateYearlyTransitAiResponse(many, pack, 'report-1')).toThrow(/primaryWindows count/);
  });

  it('rejects callback envelope keys or status outside the strict contract', () => {
    const response = base();
    expect(() => validateYearlyTransitCallback({ status: 'approved', response, extra: true }, pack, 'report-1')).toThrow(/callback envelope keys/);
    expect(() => validateYearlyTransitCallback({ status: 'rejected', response }, pack, 'report-1')).toThrow(/invalid yearly-transit rejection envelope/);
  });

  it('accepts a strict rejected callback with matching versions and sanitized reasons', () => {
    const rejected = { status: 'rejected', reportId: 'report-1', reportType: 'yearlytransit', versionBundle: pack.versionBundle, rejectReasons: ['unsupported claim'] };
    expect(validateYearlyTransitCallback(rejected, pack, 'report-1')).toMatchObject({ status: 'rejected', rejectReasons: ['unsupported claim'] });
  });
});
