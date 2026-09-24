import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib';

export interface VocationPdfInput {
  title: string;
  name: string;
  birth: { date: string; time: string; location: string };
  pack: {
    generatedLocalDate: string;
    displayTimezone: string;
    period: { fromUtc: string; toUtc: string };
    canonicalWindowHash: string;
    months: Array<{ key: string; windowIds: string[] }>;
    windows: Array<{ localStart: string; localEnd: string; mover: string; target: string; aspect: string; direction: string; score: number; exactHits?: Array<{ exactUtc: string }> }>;
  };
  sections: Array<{ id: string; heading: string; prose: string }>;
}

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 48;
const BODY_SIZE = 10;
const BODY_LEADING = 14;
const DISCLAIMER = 'Astrology is a reflective tool, not a guarantee of employment, income, wealth, or any specific outcome. Use these windows as prompts for informed choices, practical planning, and personal agency.';

function safe(value: unknown): string {
  return String(value ?? '').replace(/[—–‑‒−]/g, '-').replace(/[“”]/g, '"').replace(/[’′]/g, "'").replace(/•/g, '*').replace(/[\u00a0\u202f]/g, ' ');
}
function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of safe(text).split(/\r?\n/)) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) { lines.push(''); continue; }
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) > width && line) { lines.push(line); line = word; }
      else line = candidate;
    }
    if (line) lines.push(line);
  }
  return lines;
}

export async function buildVocationPdf(input: VocationPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const serifBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const pages: PDFPage[] = [];
  const addPage = () => { const page = pdf.addPage([PAGE_W, PAGE_H]); pages.push(page); return page; };
  let page = addPage();
  let y = PAGE_H - MARGIN;
  const usable = PAGE_W - MARGIN * 2;
  const purple = rgb(0.28, 0.08, 0.36);
  const gold = rgb(0.58, 0.38, 0.08);
  const ink = rgb(0.12, 0.1, 0.16);
  const muted = rgb(0.38, 0.36, 0.42);

  const footer = (p: PDFPage, n: number) => {
    p.drawLine({ start: { x: MARGIN, y: 30 }, end: { x: PAGE_W - MARGIN, y: 30 }, thickness: 0.6, color: gold });
    p.drawText(`Cosmic Spirit Guide  |  Vocation & Wealth Map  |  Page ${n}`, { x: MARGIN, y: 18, size: 8, font: regular, color: muted });
  };
  const newPage = () => { footer(page, pages.length); page = addPage(); y = PAGE_H - MARGIN; };
  const ensure = (height: number) => { if (y - height < 52) newPage(); };
  const heading = (text: string) => { ensure(42); page.drawText(safe(text), { x: MARGIN, y, size: 16, font: serifBold, color: purple }); y -= 22; page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.8, color: gold }); y -= 18; };
  const paragraph = (text: string, size = BODY_SIZE, font = regular, color = ink) => {
    const lines = wrap(text, font, size, usable);
    for (const line of lines) { ensure(BODY_LEADING); page.drawText(line, { x: MARGIN, y, size, font, color }); y -= BODY_LEADING; }
    y -= 6;
  };

  page.drawText('COSMIC SPIRIT GUIDE', { x: MARGIN, y, size: 12, font: bold, color: gold }); y -= 34;
  page.drawText(safe(input.title), { x: MARGIN, y, size: 28, font: serifBold, color: purple }); y -= 34;
  paragraph(`Prepared for ${input.name}`, 12, serif, muted);
  paragraph(`${input.birth.date}  |  ${input.birth.time || 'Known birth time'}  |  ${input.birth.location}`, 10, regular, muted);
  y -= 14;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 1.4, color: gold }); y -= 28;
  heading('Overview');
  paragraph(`This deterministic professional timing map begins in the saved birth-chart timezone on ${input.pack.generatedLocalDate} and covers exactly ${input.pack.months.length} calendar months.`);
  paragraph(`Display timezone: ${input.pack.displayTimezone}`);
  paragraph(`UTC period: ${input.pack.period.fromUtc} through ${input.pack.period.toUtc}`);
  paragraph(`Career windows: ${input.pack.windows.length} qualifying windows. Window-pack hash: ${input.pack.canonicalWindowHash}` , 9, regular, muted);

  const labelById: Record<string, string> = {
    coverThesis: 'Cover Thesis', careerArchetype: 'Career Archetype', publicRole: 'Public Role', moneyPsychology: 'Money Psychology',
    dailyWork: 'Daily Work', growthEngine: 'Growth Engine', legacyPower: 'Legacy Power', careerCompass: 'Career Compass', launchWindows: 'Launch Windows',
  };
  for (const section of input.sections) { heading(labelById[section.id] || section.heading); paragraph(section.prose, BODY_SIZE, regular, ink); }

  heading('Career Windows');
  for (const w of input.pack.windows) {
    ensure(34);
    const label = `${w.localStart} - ${w.localEnd}  |  ${w.mover} ${w.aspect} ${w.target}  |  ${w.direction}  |  score ${w.score}`;
    paragraph(label, 9, bold, purple);
    if (w.exactHits?.length) paragraph(`Exact hits: ${w.exactHits.map(h => h.exactUtc).join(', ')}`, 8.5, regular, muted);
  }
  heading('Disclaimer');
  paragraph(DISCLAIMER, 9.5, regular, muted);
  for (let i = 0; i < pages.length; i++) footer(pages[i], i + 1);
  return pdf.save();
}
