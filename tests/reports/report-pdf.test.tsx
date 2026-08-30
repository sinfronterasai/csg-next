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
    const secRules = doc.match(/\.sec\{[^}]*\}/g) || [];
    expect(secRules.length).toBeGreaterThan(0);
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
    expect(doc).toMatch(/h2\{[^}]*break-after:avoid/);
    expect(doc).toMatch(/h2\{[^}]*page-break-after:avoid/);
  });

  it('sets orphans/widows so body lines do not strand across a break', () => {
    const html: string[] = [];
    const restore = captureWindow(html);
    exportReportPdf(base);
    restore();
    const doc = html.join('');
    expect(doc).toMatch(/orphans:3/);
    expect(doc).toMatch(/widows:3/);
  });

  it('keeps compact section spacing that avoids an isolated one-section final page', () => {
    const html: string[] = [];
    const restore = captureWindow(html);
    exportReportPdf(base);
    restore();
    const doc = html.join('');
    expect(doc).toMatch(/\.sec\{[^}]*margin-top:16px/);
    expect(doc).toMatch(/\.bd\{[^}]*line-height:1\.55/);
  });

  it('renders the footer in NORMAL FLOW (static), not fixed — fixed bottom:0 overlapped text in Chrome', () => {
    const html: string[] = [];
    const restore = captureWindow(html);
    exportReportPdf(base);
    restore();
    const doc = html.join('');
    const footRule = (doc.match(/\.foot\{[^}]*\}/) || [''])[0];
    expect(footRule).toContain('position:static');
    expect(footRule).not.toContain('position:fixed');
    expect(footRule).not.toContain('bottom:');
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

  it('escapes every dynamic field, incl. an adversarial glyph payload (no executable markup)', () => {
    const html: string[] = [];
    const restore = captureWindow(html);
    const evil = '<img src=x onerror=alert(1)>';
    exportReportPdf({
      type: 'natal',
      title: evil,
      overview: [{ glyph: evil, label: evil, value: evil, note: evil }],
      sections: [{ heading: evil, body: evil }],
    });
    restore();
    const doc = html.join('');
    expect(doc).not.toContain('<img src=x onerror=alert(1)>');
    expect(doc).not.toContain('onerror=alert(1)>');
    expect(doc).toContain('&lt;img src=x onerror=alert(1)&gt;');
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
