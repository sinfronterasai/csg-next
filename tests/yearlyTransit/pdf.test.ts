import { PDFDocument } from 'pdf-lib';
import { buildYearlyTransitPdf } from '@/lib/yearlyTransit/pdf';
import { buildWorstCaseYearlyTransitPack } from './fixtures/worst-case-pack';

describe('yearly transit PDF artifact', () => {
  it('creates a readable non-empty PDF from the immutable pack', async () => {
    const pdf = await buildYearlyTransitPdf(buildWorstCaseYearlyTransitPack(), 'Yearly Transit Forecast', 'Seeker', [{ heading: 'Overall Theme', body: 'Evidence‑backed “interpretation” with an em—dash.' }]);
    expect(Buffer.from(pdf).subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(1_000);
    const loaded = await PDFDocument.load(pdf);
    expect(loaded.getPageCount()).toBeGreaterThan(0);
    expect(loaded.getTitle()).toBe('Yearly Transit Forecast');
  });
});
