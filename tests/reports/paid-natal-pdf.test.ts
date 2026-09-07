import { buildPaidNatalPdf, resolveFactAnchors, type PaidNatalPdfInput } from '@/lib/paidNatalPdf';

const input: PaidNatalPdfInput = {
  title: 'Natal Birth Chart Report',
  name: 'Ethan',
  birth: { date: '1980-03-09', time: '10:30', location: 'Santa Cruz, CA' },
  facts: {
    'natal.sun.position': { id: 'natal.sun.position', display: 'Sun in Pisces 18°42′', value: { key: 'sun', longitude: 348.7, signLabel: 'Pisces', degreeInSign: 18.7 } },
    'natal.moon.position': { id: 'natal.moon.position', display: 'Moon in Cancer 2°10′', value: { key: 'moon', longitude: 92.16, signLabel: 'Cancer', degreeInSign: 2.16 } },
    'natal.ascendant.position': { id: 'natal.ascendant.position', display: 'Ascendant in Gemini 14°03′', value: { key: 'ascendant', longitude: 74.05, signLabel: 'Gemini', degreeInSign: 14.05 } },
  },
  sections: [
    { heading: 'Core Identity', body: 'Your signature is [[natal.sun.position]].\nThis is narrative-first prose.' },
    { heading: 'Emotional Landscape', body: 'Your inner tide is [[natal.moon.position]].' },
  ],
};

describe('paid natal PDF vertical slice', () => {
  it('resolves every fact anchor using the authoritative display value', () => {
    const result = resolveFactAnchors(input.sections, input.facts);
    expect(result.sections[0].body).toContain('Sun in Pisces 18°42′');
    expect(result.unresolved).toEqual([]);
  });

  it('fails closed when any anchor is missing', () => {
    expect(() => resolveFactAnchors([{ heading: 'Bad', body: '[[missing.fact]]' }], input.facts)).toThrow(/unresolved fact anchors/);
  });

  it('generates a controlled PDF with premium hierarchy and blueprint visuals', () => {
    const pdf = buildPaidNatalPdf(input);
    const text = new TextDecoder().decode(pdf);
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('Cosmic Spirit Guide');
    expect(text).toContain('COSMIC BLUEPRINT');
    expect(text).toContain('PLACEMENTS');
    expect(text).toContain('ELEMENT BALANCE');
    expect(text).toContain('ASPECTS');
    expect(text).not.toContain('factsCited');
    expect(text).not.toContain('[[natal.');
    expect(text).not.toContain('about:blank');
  });
});
