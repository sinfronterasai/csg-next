/// <reference types="jest" />
// Adapter: async pipeline report sections -> legacy ReportPdfInput sections.
// Pure mapping, no DOM. Locks the public contract the Reports tab and the PDF
// path both depend on.
import {
  mapAsyncSectionsToPdf,
  asyncReportToPdfInput,
  humanizeSectionId,
  isApprovedDeliverable,
  type AsyncPublicReport,
  type AsyncSection,
} from '@/lib/reportPdfAdapter';

describe('humanizeSectionId', () => {
  it('turns snake/kebab ids into Title Case words', () => {
    expect(humanizeSectionId('core_identity')).toBe('Core Identity');
    expect(humanizeSectionId('past-present-future')).toBe('Past Present Future');
  });
  it('splits camelCase and PascalCase boundaries', () => {
    expect(humanizeSectionId('houseThemes')).toBe('House Themes');
    expect(humanizeSectionId('elementModality')).toBe('Element Modality');
    expect(humanizeSectionId('moonPhase')).toBe('Moon Phase');
    expect(humanizeSectionId('coreIdentity')).toBe('Core Identity');
  });
  it('splits dotted namespaces and camelCase together', () => {
    expect(humanizeSectionId('planetDetail.sun')).toBe('Planet Detail Sun');
    expect(humanizeSectionId('planetDetail.moonPhase')).toBe('Planet Detail Moon Phase');
  });
  it('collapses extra separators and trims', () => {
    expect(humanizeSectionId('__love__and__relationships__')).toBe('Love And Relationships');
  });
  it('falls back for empty/non-string ids', () => {
    expect(humanizeSectionId('')).toBe('Section');
    expect(humanizeSectionId(undefined)).toBe('Section');
  });
});

describe('mapAsyncSectionsToPdf', () => {
  it('maps approved sections to ordered {heading, body} pairs', () => {
    const sections: AsyncSection[] = [
      { id: 'overview_prose', prose: 'First section text.' },
      { id: 'career_path', prose: 'Second section text.' },
    ];
    const out = mapAsyncSectionsToPdf(sections);
    expect(out).toEqual([
      { heading: 'Overview Prose', body: 'First section text.' },
      { heading: 'Career Path', body: 'Second section text.' },
    ]);
    expect(out[0].body).toBe('First section text.');
    expect(out[1].body).toBe('Second section text.');
  });

  it('humanizes the real 18-section camelCase/dotted ids from the synthetic natal payload', () => {
    const sections: AsyncSection[] = [
      { id: 'planetDetail.sun', prose: 'Sun body.' },
      { id: 'houseThemes', prose: 'House body.' },
      { id: 'elementModality', prose: 'Element body.' },
      { id: 'moonPhase', prose: 'Moon phase body.' },
    ];
    const out = mapAsyncSectionsToPdf(sections);
    expect(out.map((s) => s.heading)).toEqual([
      'Planet Detail Sun',
      'House Themes',
      'Element Modality',
      'Moon Phase',
    ]);
  });

  it('omits empty/malformed/whitespace-only sections safely', () => {
    const sections: AsyncSection[] = [
      { id: 'a', prose: 'Real body.' },
      { id: 'b', prose: '' },
      { id: 'c', prose: '   \n  ' },
      { id: 'd' },
      {},
      { prose: 'No id but has prose.' },
    ];
    const out = mapAsyncSectionsToPdf(sections);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ heading: 'A', body: 'Real body.' });
    expect(out[1]).toEqual({ heading: 'Section', body: 'No id but has prose.' });
  });

  it('omits non-object entries without throwing', () => {
    const sections = [null, undefined, 42, 'x', { id: 'ok', prose: 'Body.' }] as unknown as AsyncSection[];
    const out = mapAsyncSectionsToPdf(sections);
    expect(out).toEqual([{ heading: 'Ok', body: 'Body.' }]);
  });

  it('never emits factsCited into the PDF body', () => {
    const sections: AsyncSection[] = [
      { id: 'career', prose: 'Career body.', factsCited: ['fact-1', 'fact-2'] },
    ];
    const out = mapAsyncSectionsToPdf(sections);
    expect(out).toHaveLength(1);
    expect(out[0].body).not.toContain('fact-1');
    expect(out[0].body).not.toContain('fact-2');
    expect(out[0]).not.toHaveProperty('factsCited');
  });

  it('returns an empty array for empty/undefined input', () => {
    expect(mapAsyncSectionsToPdf([])).toEqual([]);
    expect(mapAsyncSectionsToPdf(undefined)).toEqual([]);
  });
});

describe('isApprovedDeliverable', () => {
  it('is true only for approved status', () => {
    expect(isApprovedDeliverable('approved')).toBe(true);
    for (const s of ['queued', 'pending', 'needs_editor', 'rejected', null, undefined]) {
      expect(isApprovedDeliverable(s)).toBe(false);
    }
  });
});

describe('asyncReportToPdfInput', () => {
  const base: AsyncPublicReport = {
    id: 7,
    reportId: 'r-abc',
    title: 'Natal Birth Chart Report',
    type: 'natal',
    status: 'approved',
    overview: [{ label: 'Sun', value: 'Capricorn', note: 'Core' }],
    sections: [
      { id: 'core_identity', prose: 'You are grounded.', factsCited: ['f1'] },
      { id: 'empty_section', prose: '' },
    ],
    createdAt: '2026-08-01T00:00:00Z',
  };

  it('builds a ReportPdfInput with type/title/overview and filtered sections', () => {
    const input = asyncReportToPdfInput(base);
    expect(input).not.toBeNull();
    expect(input!.type).toBe('natal');
    expect(input!.title).toBe('Natal Birth Chart Report');
    expect(input!.overview).toEqual([{ label: 'Sun', value: 'Capricorn', note: 'Core' }]);
    expect(input!.sections).toEqual([{ heading: 'Core Identity', body: 'You are grounded.' }]);
  });

  it('returns null for non-approved reports (no PDF for pending/rejected/needs_editor)', () => {
    for (const status of ['queued', 'pending', 'needs_editor', 'rejected'] as const) {
      expect(asyncReportToPdfInput({ ...base, status })).toBeNull();
    }
  });

  it('defaults a missing/empty title to a readable fallback and type to "report"', () => {
    const input = asyncReportToPdfInput({ ...base, title: null, type: null });
    expect(input!.title).toBe('Cosmic Spirit Guide Report');
    expect(input!.type).toBe('report');
  });

  it('returns null when an approved report has no deliverable sections', () => {
    const input = asyncReportToPdfInput({ ...base, sections: [{ id: 'x', prose: ' ' }] });
    expect(input).toBeNull();
  });
});
