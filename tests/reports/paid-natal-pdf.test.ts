import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { buildJourneySynthesis, buildPaidNatalPdf, resolveFactAnchors } from '@/lib/paidNatalPdf';
import {
  overflowReferenceInput,
  referenceAspects,
  referenceHouses,
  referenceInput,
  referencePositions,
} from './fixtures/premiumNatalReference';

const raw = (pdf: Uint8Array) => new TextDecoder('latin1').decode(pdf);

describe('Premium Natal PDF engine', () => {
  it('fails closed on unresolved fact anchors', () => {
    expect(() => resolveFactAnchors([{ heading: 'Bad', body: '[[missing.fact]]' }], referenceInput.facts)).toThrow(/unresolved fact anchors: missing\.fact/);
  });

  it('rejects any blueprint missing the ten planets, four angles, twelve houses, or verified aspects', () => {
    expect(() => buildPaidNatalPdf({ ...referenceInput, ledger: { ...referenceInput.ledger!, positions: referencePositions.slice(0, 9) } })).toThrow(/ten planets and four angles/);
    expect(() => buildPaidNatalPdf({ ...referenceInput, ledger: { ...referenceInput.ledger!, houses: referenceHouses.slice(0, 11) } })).toThrow(/12 houses/);
    expect(() => buildPaidNatalPdf({ ...referenceInput, ledger: { ...referenceInput.ledger!, aspects: [] } })).toThrow(/verified aspects/);
  });

  it('builds a parser-valid, non-repaired, exact ten-page US Letter document with metadata', async () => {
    const pdf = buildPaidNatalPdf(referenceInput);
    const parsed = await PDFDocument.load(pdf, { updateMetadata: false, throwOnInvalidObject: true });

    expect(parsed.getPageCount()).toBe(10);
    expect(parsed.getTitle()).toBe(referenceInput.title);
    expect(parsed.getAuthor()).toBe('Cosmic Spirit Guide');
    expect(parsed.getSubject()).toBe('Personal Natal Chart Story');
    for (const page of parsed.getPages()) {
      expect(page.getWidth()).toBe(612);
      expect(page.getHeight()).toBe(792);
    }
    expect(raw(pdf)).toMatch(/^%PDF-1\.4/);
    expect(raw(pdf)).toMatch(/\/Count 10\b/);
    expect(raw(pdf)).toMatch(/startxref\s+\d+\s+%%EOF$/);
  });

  it('uses the exact reference ledger consistently in wheel, table, aspect, element, and modality modules', () => {
    const text = raw(buildPaidNatalPdf(referenceInput));
    for (const fact of referencePositions) expect(text).toContain(fact.display);
    for (const aspect of referenceAspects) expect(text).toContain(aspect.display);
    for (const house of referenceHouses) expect(text).toContain(`House ${house.num}`);
    expect(text).toContain('Earth 4');
    expect(text).toContain('Mutable 7');
    expect(text).toContain('Sun in Pisces 19deg35 - house 7');
    expect(text).not.toContain('[[');
  });

  it('personalizes the chrome and derives the closing journey from verified chart patterns', () => {
    const text = raw(buildPaidNatalPdf(referenceInput));
    expect(text).toContain('FOR ETHAN');
    expect(text).toContain('ASPECT NETWORK');
    expect(text).toContain('ELEMENT BALANCE');
    expect(text).toContain('INTEGRATION PATHWAY');

    const synthesis = buildJourneySynthesis(referenceInput);
    expect(synthesis).toContain('Ethan');
    expect(synthesis).toContain('Earth');
    expect(synthesis).toContain('Sun square Moon');
    expect(synthesis).toContain('Mars conjunct Jupiter');
    expect(synthesis).not.toMatch(/\b(?:maybe|probably|might)\b/i);
  });

  it('preserves all overflow prose through the closing continuation without blank or spill pages', () => {
    const input = overflowReferenceInput();
    const text = raw(buildPaidNatalPdf(input));

    for (let index = 1; index <= 260; index++) {
      const token = `PROSE_${String(index).padStart(4, '0')}`;
      expect(text.match(new RegExp(token, 'g'))).toHaveLength(1);
    }
    expect(text).toContain('FINAL_INPUT_TOKEN');
    expect(text).toContain('END_OF_CLOSING_SYNTHESIS');
    for (let page = 1; page <= 10; page++) expect(text).toContain(`PAGE ${page} OF 10`);
    expect(text).not.toMatch(/\b(?:NaN|undefined|null)\b/);
  });

  it('fails closed rather than drawing headings into the footer when actual line heights exceed capacity', () => {
    const headingHeavy = {
      ...referenceInput,
      sections: Array.from({ length: 368 }, (_, index) => ({ heading: `HEADING_${index + 1}`, body: '' })),
    };

    expect(() => buildPaidNatalPdf(headingHeavy)).toThrow(/premium narrative exceeds ten-page capacity/);
  });

  it('renders the deliberate ten-page editorial architecture', () => {
    const text = raw(buildPaidNatalPdf(referenceInput));
    for (const heading of [
      'YOUR COSMIC BLUEPRINT',
      'ELEMENT BALANCE',
      'YOUR VERIFIED CHART AT A GLANCE',
      'THE MAIN NARRATIVE',
      'YOUR PLANETARY GUIDES',
      'YOUR CENTRAL GIFTS',
      'YOUR RECURRING TENSIONS',
      'PRACTICAL ALIGNMENT PLAN',
      'CLOSING SYNTHESIS',
    ]) expect(text).toContain(heading);
    expect(text).toContain('DARK EDITORIAL COVER');
    expect(text).toContain('CREAM BODY');
  });

  it('keeps the planetary opener populated and makes alignment sections actionable', () => {
    const text = raw(buildPaidNatalPdf(referenceInput));
    expect(text).toContain('INTEGRATION PATHWAY');
    expect(text).toContain('Gift: identity and purpose. Practice: name the value this placement serves.');
    expect(text).toContain('YOUR CENTRAL GIFTS');
    expect(text).toContain('Venus trine Jupiter - orb 0deg10 - ease that grows through practice');
    expect(text).toContain('YOUR RECURRING TENSIONS');
    expect(text).toContain('A CHART-GROUNDED FOUR-WEEK LOOP');
    expect(text).toContain('WEEK 4 - REVIEW');
    expect(text).not.toMatch(/\n\s*equilibrium\.?\s*\n/i);
  });

  it('writes the deterministic Santa Cruz artifact fixture', () => {
    const first = buildPaidNatalPdf(referenceInput);
    const second = buildPaidNatalPdf(referenceInput);
    expect(Buffer.from(first).equals(Buffer.from(second))).toBe(true);
    const artifact = join(process.cwd(), 'tests/reports/fixtures/generated-paid-natal.pdf');
    writeFileSync(artifact, first);
    expect(first.byteLength).toBeGreaterThan(25_000);
  });
});
