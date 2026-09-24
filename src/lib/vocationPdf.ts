import { PDFDocument, rgb, type PDFPage, type PDFFont } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildVocationAppendix, buildVocationPeriods, customerCoverageLabel, explainDirection, humanAspect, humanPlanet, humanTarget } from './vocationPresentation';

export interface VocationPdfInput {
  title: string;
  name: string;
  birth: { date: string; time: string; location: string };
  pack: {
    generatedLocalDate: string;
    displayTimezone: string;
    period: { fromUtc: string; toUtc: string };
    months: Array<{ key: string; windowIds: string[] }>;
    windows: Array<{ id: string; localStart: string; localEnd: string; mover: string; target: string; aspect: string; direction: string; score: number; activeWindow?: { startUtc: string; endUtc: string }; exactHits?: Array<{ exactUtc: string }> }>;
  };
  sections: Array<{ id: string; heading: string; prose: string }>;
}

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 48;
const BODY_SIZE = 10;
const BODY_LEADING = 14;
const DISCLAIMER = 'Astrology is a reflective tool, not a promise of employment, income, wealth, or any specific outcome. Use these windows as prompts for informed choices, practical planning, and personal agency.';
const SECTION_LABELS: Record<string, string> = {
  coverThesis: 'Cover Thesis', careerArchetype: 'Career Archetype', publicRole: 'Public Role', moneyPsychology: 'Money Psychology',
  dailyWork: 'Daily Work', growthEngine: 'Growth Engine', legacyPower: 'Legacy Power', careerCompass: 'Career Compass', launchWindows: 'Launch Windows',
};

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
      if (font.widthOfTextAtSize(candidate, size) > width && line) { lines.push(line); line = word; } else line = candidate;
    }
    if (line) lines.push(line);
  }
  return lines;
}

export async function buildVocationPdf(input: VocationPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const regular = await pdf.embedFont(readFileSync(join(process.cwd(), 'src/assets/DejaVuSans.ttf')));
  const bold = await pdf.embedFont(readFileSync(join(process.cwd(), 'src/assets/DejaVuSans-Bold.ttf')));
  const serif = regular;
  const serifBold = bold;
  const pages: PDFPage[] = [];
  const purple = rgb(0.28, 0.08, 0.36), gold = rgb(0.58, 0.38, 0.08), ink = rgb(0.12, 0.1, 0.16), muted = rgb(0.38, 0.36, 0.42);
  let page = pdf.addPage([PAGE_W, PAGE_H]); pages.push(page); let y = PAGE_H - MARGIN;
  const usable = PAGE_W - MARGIN * 2;
  const footer = (p: PDFPage, n: number) => { p.drawLine({ start: { x: MARGIN, y: 30 }, end: { x: PAGE_W - MARGIN, y: 30 }, thickness: 0.6, color: gold }); p.drawText(`Cosmic Spirit Guide  |  Vocation & Wealth Map  |  Page ${n}`, { x: MARGIN, y: 18, size: 8, font: regular, color: muted }); };
  const newPage = () => { footer(page, pages.length); page = pdf.addPage([PAGE_W, PAGE_H]); pages.push(page); y = PAGE_H - MARGIN; };
  const ensure = (height: number) => { if (y - height < 54) newPage(); };
  const heading = (text: string) => { ensure(50); page.drawText(safe(text), { x: MARGIN, y, size: 16, font: serifBold, color: purple }); y -= 22; page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.8, color: gold }); y -= 18; };
  const paragraph = (text: string, size = BODY_SIZE, font = regular, color = ink) => { for (const line of wrap(text, font, size, usable)) { ensure(BODY_LEADING); page.drawText(line, { x: MARGIN, y, size, font, color }); y -= BODY_LEADING; } y -= 6; };
  const label = (text: string) => { ensure(28); page.drawText(safe(text), { x: MARGIN, y, size: 9, font: bold, color: gold }); y -= 15; };

  const displayName = safe(input.name.trim() || 'You');
  const periods = buildVocationPeriods(input.pack.windows);
  const appendix = buildVocationAppendix(input.pack.windows);
  page.drawText('COSMIC SPIRIT GUIDE', { x: MARGIN, y, size: 12, font: bold, color: gold }); y -= 34;
  page.drawText(safe(input.title), { x: MARGIN, y, size: 28, font: serifBold, color: purple }); y -= 34;
  paragraph(`Prepared for ${displayName}`, 12, serif, muted);
  paragraph(`${safe(input.birth.date)}  |  ${safe(input.birth.time || 'Known birth time')}  |  ${safe(input.birth.location)}`, 10, regular, muted);
  y -= 10; page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 1.4, color: gold }); y -= 26;

  heading('Overview');
  paragraph(`Coverage: ${customerCoverageLabel(input.pack)}.`);
  paragraph(`This map uses UTC internally and shows customer-facing dates in the saved IANA timezone: ${safe(input.pack.displayTimezone)}.`);
  paragraph(`The report contains ${input.pack.windows.length} qualifying windows. Scores are intentionally omitted from the customer view; the ordering and selection are deterministic, while the meaning remains reflective rather than predictive.`);

  for (const section of input.sections) { heading(SECTION_LABELS[section.id] || section.heading); paragraph(section.prose); }

  heading('Prioritized action plan');
  paragraph('Next 30 days: choose one practical vocational question, define the smallest test that would answer it, and record what you learn.');
  paragraph('Next 60 days: turn the strongest result into a repeatable practice, portfolio item, conversation, or boundary that supports your longer-term direction.');
  paragraph('Next 90 days: review evidence rather than intensity. Keep what improves fit, value, and capacity; revise what creates pressure without useful return.');

  heading('Featured periods');
  for (const period of periods) {
    ensure(100); label(`${period.name}: ${period.start} through ${period.end}`);
    paragraph(period.meaning);
    paragraph(`Consider: ${period.action}`);
    paragraph(`Tradeoff: ${period.caution}`, 9.5, regular, muted);
  }

  heading('Career-window appendix');
  paragraph('The appendix is complete and ordered by local start date. Applying means the pattern is building toward a closer expression; separating means you are integrating what has already become visible; stationary means the emphasis may feel paused or require patience. These labels describe the transit phase, not a guaranteed event.');
  for (const item of appendix) {
    ensure(44); label(`${item.start} through ${item.end}`); paragraph(item.transit, 9.5, bold, purple); paragraph(`${item.direction}${item.exact ? `. Exact contact dates: ${item.exact.split(', ').map((x) => x.slice(0, 10)).join(', ')}.` : '.'}`, 9, regular, muted);
  }

  heading('Method and disclaimer');
  paragraph('Career windows are deterministic intervals derived from the saved birth snapshot, the stated target set, and the report period. The interpretive sections cite the same verified evidence used by the report UI. No window is an instruction to spend money, change employment, or expect a particular outcome.');
  paragraph(DISCLAIMER, 9.5, regular, muted);
  pages.forEach((p, index) => footer(p, index + 1));
  return pdf.save();
}
