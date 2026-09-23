import { buildYearlyTransitIcs } from '@/lib/yearlyTransit/ics';
import { buildWorstCaseYearlyTransitPack } from './fixtures/worst-case-pack';

describe('yearly transit ICS export', () => {
  it('emits deterministic primary-window and exact-hit events only', () => {
    const pack = buildWorstCaseYearlyTransitPack();
    const first = buildYearlyTransitIcs(pack, 'report-1');
    const second = buildYearlyTransitIcs(pack, 'report-1');
    expect(first).toBe(second);
    expect(first.endsWith('\r\n')).toBe(true);
    expect(first).not.toContain('TZID=');
    expect(first).toContain('X-CSG-DISPLAY-TIMEZONE:America/Los_Angeles');
    expect(first.match(/BEGIN:VEVENT/g)).toHaveLength(24);
    const unfolded = first.replace(/\r\n /g, '');
    expect(unfolded.match(/UID:[a-f0-9]{64}@cosmicspiritguide\.com/g)).toHaveLength(24);
    expect(unfolded.match(/DTSTART:\d{8}T\d{6}Z/g)).toHaveLength(24);
    expect(first).not.toContain('appendix');
    expect(first).toContain('SUMMARY:jupiter conjunction sun window begins');
    expect(first).toContain('SUMMARY:jupiter exact conjunction sun');
  });

  it('deduplicates repeated event tuples from duplicate primary rows', () => {
    const pack: any = buildWorstCaseYearlyTransitPack();
    pack.windows[1] = { ...pack.windows[0], id: 'duplicate-row', canonicalTransitId: pack.windows[0].canonicalTransitId };
    pack.aiPacks.primaryWindows = pack.windows.map((window: any) => ({ id: window.id, evidenceIds: window.evidenceIds }));
    const ics = buildYearlyTransitIcs(pack, 'report-1');
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(21);
  });
});
