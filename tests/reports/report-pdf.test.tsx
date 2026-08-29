/** @jest-environment jsdom */
// PDF export path: narrative-first branded print doc. Locks the contract the
// Reports tab "Download PDF" control and the legacy ReportResult caller share.
import { exportReportPdf, type ReportPdfInput } from '@/lib/reportPdf';

function captureWindow(htmlSink: string[]) {
  const fakeDoc = { write: (h: string) => htmlSink.push(h), close: () => {} };
  const origOpen = window.open;
  // @ts-expect-error mock
  window.open = () => ({ document: fakeDoc, focus: () => {}, print: () => {} });
  jest.useFakeTimers();
  return () => { jest.useRealTimers(); window.open = origOpen; };
}

const base: ReportPdfInput = {
  type: 'natal',
  title: 'Natal Birth Chart Report',
  overview: [{ glyph: '\u2609', label: 'Sun', value: 'Capricorn', note: 'Core self' }],
  sections: [
    { heading: 'Core Identity', body: 'Short body.' },
    { heading: 'Career Path', body: 'Longer body text.\nSecond line.' },
  ],
};

describe('exportReportPdf', () => {
  it('renders brand header, footer, title and section prose', () => {
    const html: string[] = [];
    const restore = captureWindow(html);
    exportReportPdf(base);
    restore();
    const doc = html.join('');
    expect(doc).toContain('Cosmic Spirit Guide');
    expect(doc).toContain('cosmicspiritguide.com');
    expect(doc).toContain('Natal Birth Chart Report');
    expect(doc).toContain('Core Identity');
    expect(doc).toContain('Career Path');
    expect(doc).toContain('Short body.');
  });

  it('renders the overview table when overview rows exist', () => {
    const html: string[] = [];
    const restore = captureWindow(html);
    exportReportPdf(base);
    restore();
    const doc = html.join('');
    expect(doc).toContain('<table');
    expect(doc).toContain('Capricorn');
  });

  it('omits the overview table entirely when overview is empty (no empty table)', () => {
    const html: string[] = [];
    const restore = captureWindow(html);
    exportReportPdf({ ...base, overview: [] });
    restore();
    const doc = html.join('');
    expect(doc).not.toContain('<table');
    expect(doc).toContain('Core Identity');
  });

  it('applies break-inside:avoid so short sections/headings do not split across pages', () => {
    const html: string[] = [];
    const restore = captureWindow(html);
    exportReportPdf(base);
    restore();
    expect(html.join('')).toContain('break-inside:avoid');
  });

  it('includes print CSS (@media print or @page) for intentional pagination', () => {
    const html: string[] = [];
    const restore = captureWindow(html);
    exportReportPdf(base);
    restore();
    const doc = html.join('');
    expect(doc.includes('@media print') || doc.includes('@page')).toBe(true);
  });

  it('fails gracefully and writes nothing when window.open returns null (popup blocked)', () => {
    const origOpen = window.open;
    // @ts-expect-error mock
    window.open = () => null;
    jest.useFakeTimers();
    let threw = false;
    try {
      exportReportPdf(base);
    } catch {
      threw = true;
    }
    jest.useRealTimers();
    window.open = origOpen;
    expect(threw).toBe(false);
  });
});
