import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { YearlyTransitFactPack } from './types';

function lines(value: string, width = 92): string[] {
  return value.split(/\r?\n/).flatMap((paragraph) => {
    const words = paragraph.split(/\s+/).filter(Boolean); if (!words.length) return [''];
    const out: string[] = []; let current = '';
    for (const word of words) { if (current && current.length + word.length + 1 > width) { out.push(current); current = word; } else current = current ? `${current} ${word}` : word; }
    if (current) out.push(current); return out;
  });
}

export async function buildYearlyTransitPdf(pack: YearlyTransitFactPack, title: string, name: string, sections: Array<{ heading: string; body: string }> = []): Promise<Uint8Array> {
  if (!pack || pack.reportType !== 'yearlytransit' || !pack.versionBundle) throw new Error('complete yearly-transit pack required');
  const pdf = await PDFDocument.create(); const regular = await pdf.embedFont(StandardFonts.Helvetica); const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([612, 792]); let y = 742;
  const draw = (text: string, size = 10, font = regular, color = rgb(0.15, 0.12, 0.2)) => { if (y < 52) { page = pdf.addPage([612, 792]); y = 742; } page.drawText(text, { x: 42, y, size, font, color }); y -= size + 6; };
  const heading = (text: string) => { if (y < 90) { page = pdf.addPage([612, 792]); y = 742; } draw(text, 15, bold, rgb(0.29, 0.08, 0.38)); y -= 5; };
  draw('COSMIC SPIRIT GUIDE', 9, bold, rgb(0.65, 0.52, 0.18)); draw(title, 22, bold, rgb(0.18, 0.07, 0.28)); draw(`Prepared for ${name}`, 11, regular); draw(`Forecast: ${pack.period.fromUtc} through ${pack.period.toUtc}`, 9); draw(`Display timezone: ${pack.displayTimezone}`, 9); y -= 14;
  heading('Versioned deterministic foundation');
  for (const [key, value] of Object.entries(pack.versionBundle)) draw(`${key}: ${value}`, 8.5);
  heading('Primary transit windows');
  const primaryIds = new Set(pack.aiPacks.primaryWindows.map((item) => item.id));
  for (const window of pack.windows.filter((item) => primaryIds.has(item.id)).slice(0, 8)) {
    draw(`${window.mover} ${window.aspectType} ${window.target} · score ${window.importanceScore}/${window.rawImportanceScore}`, 10, bold);
    draw(`Window ${window.activeWindow.startUtc} to ${window.activeWindow.endUtc}; direction ${window.segments[0]?.direction ?? 'indeterminate'}; exact hits ${window.exactHits.length}`, 8.5);
  }
  heading('Monthly context');
  for (const item of pack.aiPacks.monthlyContext) draw(item.id, 9, bold);
  heading('Appendix evidence'); for (const item of pack.aiPacks.appendixEvidence) draw(item.id, 8.5);
  for (const section of sections) { heading(section.heading); for (const text of lines(section.body)) draw(text, 9); }
  pdf.setTitle(title); pdf.setAuthor('Cosmic Spirit Guide'); pdf.setSubject('Deterministic Yearly Transit Forecast');
  return pdf.save();
}
