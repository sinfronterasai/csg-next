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
  overview: [{ glyph: '☉', label: 'Sun', value: 'Capricorn', note: 'Core self' }],
  sections: [
    { heading: 'Core Identity', body: 'Short body.' },
    { heading: 'Career Path', body: 'Longer body text.\nSecond line.' },
    { heading: 'Moon Phase', body: 'Final section body.' },
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

  it('does NOT force every section to be indivisible (no blanket break-inside:avoid on .sec)', () => {
    const html: string[] = [];
    const restore = captureWindow(html);
    exportReportPdf(base);
    restore();
    const doc = html.join('');
    // A .sec rule that contains break-inside:avoid would force the
    // mostly-blank final page John flagged; it must be gone from .sec.
    const secRules = doc.match(/\.sec\{[^}]*\}/g) || [];
    for (const rule of secRules) {
      expect(rule).not.toContain('break-inside:avoid');
      expect(rule).not.toContain('page-break-inside:avoid');
    }
  });

  it('keeps headings attached to their first body lines (heading break control)', () => {
    const html: string[] = [];
    const restore = captureWindow(html);
    exportReportPdf(base);
    restore();
    const doc = html.join('');
    // heading-level break control so a heading never strands at a page foot
    expect(doc).toMatch(/h2\{[^}]*break-after:avoid/);
    expect(doc).toMatch(/h2\{[^}]*page-break-after:avoid/);
  });

  it('sets orphans/widows so body lines do not strand across a break', () => {
    const html: string[] = [];
    const restore = captureWindow(html);
    exportReportPdf(base);
    restore();
    const doc = html.join('');
    expect(doc).toMatch(/orphans:\d/);
    expect(doc).toMatch(/widows:\d/);
  });

  it('pins the footer to the page bottom instead of floating after the last section', () => {
    const html: string[] = [];
    const restore = captureWindow(html);
    exportReportPdf(base);
    restore();
    const doc = html.join('');
    // Footer anchored (fixed/running) rather than floating in normal flow.
    const footRule = (doc.match(/\.foot\{[^}]*\}/) || [''])[0];
    expect(footRule).toContain('position:fixed');
    expect(footRule).toMatch(/bottom:0/);
  });

  it('includes print CSS (@media print or @page) for intentional pagination', () => {
    const html: string[] = [];
    const restore = captureWindow(html);
    exportReportPdf(base);
    restore();
    const doc = html.join('');
    expect(doc.includes('@media print') || doc.includes('@page')).toBe(true);
  });

  it('escapes HTML in prose so report content cannot inject markup', () => {
    const html: string[] = [];
    const restore = captureWindow(html);
    exportReportPdf({
      ...base,
      overview: [],
      sections: [{ heading: 'Safe', body: '<script>alert(1)</script> **bold**' }],
    });
    restore();
    const doc = html.join('');
    expect(doc).not.toContain('<script>alert(1)</script>');
    expect(doc).toContain('&lt;script&gt;');
    expect(doc).toContain('<strong>bold</strong>');
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
