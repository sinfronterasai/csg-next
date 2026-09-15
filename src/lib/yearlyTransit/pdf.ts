import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib';
import type { YearlyTransitFactPack } from './types';
import { buildYearlyTransitPresentation, type GroupedTransitPresentation, type YearlyTransitPresentation } from './presentation';

function winAnsiText(value: string): string {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2212]/g, '-')
    .replace(/[\u2018\u2019\u201a\u201b]/g, "'")
    .replace(/[\u201c\u201d\u201e\u201f]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/\u2022/g, '*')
    .replace(/\u2192/g, '->')
    .replace(/[^\x20-\x7e\u00a1-\u00ff]/g, '?');
}

function dateLabel(utc: string, timezone: string, withDay = false): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: timezone, month: 'short', day: withDay ? 'numeric' : undefined, year: 'numeric' }).format(new Date(utc));
}
function rangeLabel(start: string, end: string, timezone: string): string {
  const startLabel = dateLabel(start, timezone);
  const endLabel = dateLabel(end, timezone);
  return startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`;
}
function hitLabel(utc: string, timezone: string): string { return dateLabel(utc, timezone, true); }
function phaseLabel(phase: GroupedTransitPresentation['phases'][number], timezone: string): string {
  return `${phase.label}: ${rangeLabel(phase.startUtc, phase.endUtc, timezone)}`;
}
function textLines(value: string, width = 88): string[] {
  return value.split(/\r?\n/).flatMap((paragraph) => {
    const words = paragraph.split(/\s+/).filter(Boolean); if (!words.length) return [''];
    const out: string[] = []; let current = '';
    for (const word of words) { if (current && current.length + word.length + 1 > width) { out.push(current); current = word; } else current = current ? `${current} ${word}` : word; }
    if (current) out.push(current); return out;
  });
}

export interface YearlyTransitPdfSection { heading: string; body: string }

export async function buildYearlyTransitPdf(pack: YearlyTransitFactPack, title: string, name: string, sections: YearlyTransitPdfSection[] = []): Promise<Uint8Array> {
  if (!pack || pack.reportType !== 'yearlytransit' || !pack.versionBundle) throw new Error('complete yearly-transit pack required');
  const presentation = buildYearlyTransitPresentation(pack);
  const themeSections = sections.filter((section) => /theme|overview|year at a glance/i.test(section.heading));
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([612, 792]);
  let y = 742;
  const margin = 42;
  const newPage = () => { page = pdf.addPage([612, 792]); y = 742; };
  const ensure = (height: number) => { if (y - height < 48) newPage(); };
  const draw = (value: string, size = 10, font: PDFFont = regular, color = rgb(0.15, 0.12, 0.2), gap = 5) => { ensure(size + gap); page.drawText(winAnsiText(value), { x: margin, y, size, font, color }); y -= size + gap; };
  const paragraph = (value: string, size = 10) => { const wrapped = textLines(value, 82); const needed = wrapped.length * (size + 4) + 5; if (needed < 700 && y - needed < 48) newPage(); for (const line of wrapped) draw(line, size, regular, rgb(0.15, 0.12, 0.2), 3); y -= 5; };
  const heading = (value: string) => { ensure(86); y -= 8; draw(value, 15, bold, rgb(0.29, 0.08, 0.38), 4); page.drawLine({ start: { x: margin, y: y + 1 }, end: { x: 570, y: y + 1 }, thickness: 0.7, color: rgb(0.78, 0.62, 0.18) }); y -= 10; };
  const label = (value: string) => draw(value, 8.5, bold, rgb(0.55, 0.38, 0.08), 3);
  const bullet = (value: string) => { ensure(18); draw(`- ${value}`, 9.5, regular, rgb(0.15, 0.12, 0.2), 3); };
  const drawTableRow = (cells: string[], widths: number[], header = false) => {
    const rowHeight = header ? 24 : 34; ensure(rowHeight);
    let x = margin;
    cells.forEach((cell, index) => { const lines = textLines(cell, Math.max(10, Math.floor(widths[index] / 6.2))).slice(0, 2); lines.forEach((line, lineIndex) => page.drawText(winAnsiText(line), { x: x + 5, y: y - 13 - lineIndex * 10, size: header ? 8.5 : 9.5, font: header ? bold : regular, color: header ? rgb(0.55, 0.38, 0.08) : rgb(0.15, 0.12, 0.2) })); x += widths[index]; });
    page.drawLine({ start: { x: margin, y: y - rowHeight + 2 }, end: { x: 570, y: y - rowHeight + 2 }, thickness: 0.4, color: rgb(0.88, 0.83, 0.7) }); y -= rowHeight;
  };

  draw('COSMIC SPIRIT GUIDE', 10, bold, rgb(0.65, 0.52, 0.18), 8);
  draw('Yearly Transit Forecast', 25, bold, rgb(0.18, 0.07, 0.28), 8);
  draw(`Prepared for ${name || 'You'}`, 12, regular, rgb(0.15, 0.12, 0.2), 5);
  draw(`Forecast period: ${rangeLabel(presentation.periodStartUtc, presentation.periodEndUtc, presentation.timezone)}`, 10, regular, rgb(0.35, 0.32, 0.38), 3);
  draw(`Generated: ${dateLabel(pack.snapshot.generatedAtUtc, presentation.timezone, true)}`, 9, regular, rgb(0.35, 0.32, 0.38), 3);
  y -= 24;

  heading('Your year at a glance');
  paragraph('This forecast follows the strongest patterns in your sky over the coming twelve months. The periods below are organized by the relationships that matter most, with their unfolding phases and exact moments kept visible so you can work with the timing consciously.');
  if (themeSections.length) { heading('The arc of your year'); themeSections.forEach((section) => paragraph(section.body)); }
  paragraph('Read an active window as a season of attention. Exact hits are useful checkpoints inside that season, while applying, return, and separating phases describe how the emphasis develops and integrates.');

  heading('Major transit windows');
  if (presentation.groupedTransits.length === 0) paragraph('No major transit windows met the report threshold for this period. The monthly guide below remains available for quieter integration and reflection.');
  else {
    drawTableRow(['Transit', 'Active period', 'Importance'], [280, 170, 80], true);
    for (const transit of presentation.groupedTransits.slice(0, 8)) drawTableRow([transit.heading, rangeLabel(transit.activeStartUtc, transit.activeEndUtc, presentation.timezone), transit.importance], [280, 170, 80]);
  }

  heading('Your most important transits');
  for (const transit of presentation.groupedTransits.slice(0, 8)) {
    ensure(100);
    draw(transit.heading.toUpperCase(), 14, bold, rgb(0.29, 0.08, 0.38), 4);
    draw(`Importance: ${transit.importance}`, 9.5, bold, rgb(0.55, 0.38, 0.08), 3);
    draw(`Active: ${rangeLabel(transit.activeStartUtc, transit.activeEndUtc, presentation.timezone)}`, 9.5, regular, rgb(0.15, 0.12, 0.2), 3);
    draw(`Life area: ${transit.lifeArea}`, 9.5, regular, rgb(0.15, 0.12, 0.2), 4);
    if (transit.exactHits.length) { label('EXACT HITS'); transit.exactHits.forEach((hit) => bullet(`${hitLabel(hit.utc, presentation.timezone)}${hit.retrograde ? ' (retrograde)' : ''}`)); y += 3; }
    if (transit.phases.length) { label('HOW THIS TRANSIT UNFOLDS'); transit.phases.forEach((phase) => bullet(phaseLabel(phase, presentation.timezone))); y += 3; }
    paragraph(`${transit.passCount > 1 ? `This relationship returns in ${transit.passCount} connected passes, creating a longer conversation rather than separate unrelated events. ` : ''}${transit.retrograde ? 'A return or stationary phase is part of the deterministic timing, so revisit and integration are part of the process. ' : ''}Use the active period as a window for attention, choice, and reflection rather than as a fixed prediction.`);
    y -= 8;
  }

  heading('Month by month');
  for (const month of presentation.monthly) {
    ensure(44);
    draw(month.label, 11, bold, rgb(0.29, 0.08, 0.38), 3);
    if (month.transitIds.length) {
      const names = month.transitIds.map((id) => presentation.groupedTransits.find((transit) => transit.id === id)?.heading).filter(Boolean).join('; ');
      paragraph(`${month.summary}: ${names}.`, 9.5);
    } else paragraph('Integration and consolidation: a quieter month in the selected major-window set. Use this space to review what the active periods have clarified and prepare for the next shift.', 9.5);
  }

  heading('Action plan');
  const actionSections = sections.filter((section) => /action|recommend|plan/i.test(section.heading));
  if (actionSections.length) {
    actionSections.forEach((section) => paragraph(section.body));
    for (const transit of presentation.groupedTransits.slice(0, 3)) bullet(`Use the ${transit.heading} period (${rangeLabel(transit.activeStartUtc, transit.activeEndUtc, presentation.timezone)}) to make one deliberate choice in ${transit.lifeArea.toLowerCase()}.`);
  } else {
    for (const transit of presentation.groupedTransits.slice(0, 5)) bullet(`During the ${rangeLabel(transit.activeStartUtc, transit.activeEndUtc, presentation.timezone)} ${transit.heading} period, choose one practical step that supports your ${transit.lifeArea.toLowerCase()}.`);
    paragraph('Return to the exact-hit dates as checkpoints for noticing what is becoming clearer, what needs restructuring, and where a deliberate choice would serve you better than a reflexive one.');
  }

  if (presentation.appendix.length) {
    heading('Supporting influences');
    drawTableRow(['Transit', 'Active window', 'Importance / meaning'], [190, 150, 190], true);
    for (const item of presentation.appendix.slice(0, 30)) drawTableRow([item.transit, rangeLabel(item.startUtc, item.endUtc, presentation.timezone), `${item.importance}: ${item.meaning}`], [190, 150, 190]);
  }

  pdf.setTitle(title || 'Yearly Transit Forecast'); pdf.setAuthor('Cosmic Spirit Guide'); pdf.setSubject('Personalized Yearly Transit Forecast');
  return pdf.save();
}
