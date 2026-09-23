import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import type { YearlyTransitFactPack } from './types';
import { buildYearlyTransitPresentation } from './presentation';
import { curatedMajorInfluences, curatedMonths, curatedSignificantInfluences, curatedSupportingInfluences, customerDate, customerPeriod } from './curation';

function safe(value: string): string {
  return value.replace(/\u00a0/g, ' ').replace(/[\u2010-\u2014\u2212]/g, '-').replace(/[\u2018-\u201f]/g, "'").replace(/\u2026/g, '...').replace(/\u2022/g, '*').replace(/[^\x20-\x7e\u00a1-\u00ff]/g, '?');
}
function lines(value: string, width = 82): string[] {
  return value.split(/\r?\n/).flatMap((paragraph) => {
    const words = paragraph.trim().split(/\s+/).filter(Boolean); const output: string[] = []; let current = '';
    for (const word of words) { if (current && current.length + word.length + 1 > width) { output.push(current); current = word; } else current = current ? `${current} ${word}` : word; }
    return current ? [...output, current] : output;
  });
}
function measuredLines(value: string, font: PDFFont, size: number, width: number): string[] {
  return value.split(/\r?\n/).flatMap((paragraph) => {
    const words = paragraph.trim().split(/\s+/).filter(Boolean); const output: string[] = []; let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (current && font.widthOfTextAtSize(safe(candidate), size) > width) { output.push(current); current = word; } else current = candidate;
    }
    return current ? [...output, current] : output;
  });
}
export interface YearlyTransitPdfSection { heading: string; body: string }

export async function buildYearlyTransitPdf(pack: YearlyTransitFactPack, title: string, name: string, sections: YearlyTransitPdfSection[] = []): Promise<Uint8Array> {
  if (!pack || pack.reportType !== 'yearlytransit' || !pack.versionBundle) throw new Error('complete yearly-transit pack required');
  const presentation = buildYearlyTransitPresentation(pack); const major = curatedMajorInfluences(pack); const significant = curatedSignificantInfluences(pack); const months = curatedMonths(pack); const supporting = curatedSupportingInfluences(pack);
  const pdf = await PDFDocument.create(); const regular = await pdf.embedFont(StandardFonts.Helvetica); const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([612, 792]); let y = 744; const margin = 42;
  const newPage = () => { page = pdf.addPage([612, 792]); y = 744; };
  const ensure = (height: number) => { if (y - height < 50) newPage(); };
  const draw = (value: string, size = 10, font: PDFFont = regular, color = rgb(.15,.12,.2), gap = 4) => { ensure(size + gap); page.drawText(safe(value), { x: margin, y, size, font, color }); y -= size + gap; };
  const paragraph = (value: string, size = 10) => { const wrapped = lines(value); const height = wrapped.length * (size + 3) + 5; if (height < 680 && y - height < 50) newPage(); for (const line of wrapped) draw(line, size, regular, rgb(.15,.12,.2), 3); y -= 5; };
  const heading = (value: string) => { ensure(92); y -= 7; draw(value, 15, bold, rgb(.29,.08,.38), 4); page.drawLine({ start:{x:margin,y:y+1}, end:{x:570,y:y+1}, thickness:.7, color:rgb(.78,.62,.18) }); y -= 10; };
  const label = (value: string) => draw(value, 8.5, bold, rgb(.55,.38,.08), 3);
  const bullet = (value: string) => { ensure(18); draw(`- ${value}`, 9.5, regular, rgb(.15,.12,.2), 3); };
  let activeTableHeader: { cells: string[]; widths: number[]; size: number } | null = null;
  const drawTableHeader = () => {
    if (!activeTableHeader) return;
    let x = margin;
    activeTableHeader.cells.forEach((cell, i) => { page.drawText(safe(cell), { x: x + 5, y: y - 13, size: activeTableHeader!.size, font: bold, color: rgb(.55,.38,.08) }); x += activeTableHeader!.widths[i]; });
    page.drawLine({ start: { x: margin, y: y - 22 }, end: { x: 570, y: y - 22 }, thickness: .4, color: rgb(.78,.62,.18) });
    y -= 24;
  };
  const table = (cells: string[], widths: number[], header = false, _maxLines = 2) => {
    const font = header ? bold : regular; const size = header ? 8.5 : 9.2; const padding = 10;
    if (header) { activeTableHeader = { cells, widths, size }; ensure(24); drawTableHeader(); return; }
    const wrapped = cells.map((cell, i) => measuredLines(cell, font, size, widths[i] - padding));
    const rowHeight = Math.max(36, 14 + Math.max(...wrapped.map((cell) => cell.length), 1) * 10);
    if (y - rowHeight < 50) { newPage(); drawTableHeader(); }
    let x = margin;
    wrapped.forEach((cellLines, i) => { cellLines.forEach((line, j) => page.drawText(safe(line), { x: x + 5, y: y - 13 - j * 10, size, font, color: rgb(.15,.12,.2) })); x += widths[i]; });
    page.drawLine({ start: { x: margin, y: y - rowHeight + 2 }, end: { x: 570, y: y - rowHeight + 2 }, thickness: .4, color: rgb(.88,.83,.7) });
    y -= rowHeight;
  };
  const section = (id: string, matching?: string) => sections.find((item) => item.heading === id) ?? sections.find((item) => item.heading.toLowerCase().includes((matching || id).toLowerCase()));

  draw('COSMIC SPIRIT GUIDE', 10, bold, rgb(.65,.52,.18), 8); draw('Yearly Transit Forecast', 25, bold, rgb(.18,.07,.28), 8); draw(`Prepared for ${name || 'You'}`, 12); draw(`Forecast period: ${customerPeriod(pack.period.fromUtc, pack.period.toUtc, pack.displayTimezone)}`, 10, regular, rgb(.35,.32,.38), 3); draw(`Generated: ${customerDate(pack.snapshot.generatedAtUtc, pack.displayTimezone).label}`, 9, regular, rgb(.35,.32,.38), 3); y -= 20;
  heading('Your year at a glance'); paragraph('This forecast brings the most meaningful transit patterns into focus: what is developing, when it is most active, and where a deliberate response can be useful.');
  const theme = section('theme', 'theme') || section('overall theme', 'overview'); if (theme) { label('THE ARC OF YOUR YEAR'); paragraph(theme.body); }
  heading('Major transit windows'); table(['Transit','Active period','Importance'], [280,170,80], true); for (const transit of major) table([transit.heading, transit.activePeriod, transit.importance], [280,170,80]);
  heading('Your most important transits');
  for (const item of major) {
    const transit = presentation.groupedTransits.find((group) => group.id === item.id);
    if (!transit) throw new Error(`missing grouped presentation for ${item.id}`);
    ensure(150); draw(transit.heading.toUpperCase(), 14, bold, rgb(.29,.08,.38), 4); draw(`Importance: ${transit.importance}`,9.5,bold,rgb(.55,.38,.08),3); draw(`Active: ${customerPeriod(transit.activeStartUtc,transit.activeEndUtc,pack.displayTimezone)}`,9.5); draw(`Life area: ${transit.lifeArea}`,9.5,regular,rgb(.15,.12,.2),4);
    if (transit.exactHits.length) { label('EXACT HITS'); transit.exactHits.forEach((hit) => bullet(`${customerDate(hit.utc,pack.displayTimezone).label}${hit.retrograde?' (retrograde)':''}`)); }
    if (transit.phases.length) { label('HOW THIS TRANSIT MAY DEVELOP'); transit.phases.forEach((phase) => bullet(`${phase.label}: ${customerPeriod(phase.startUtc,phase.endUtc,pack.displayTimezone)}`)); }
    const narrative = section(`primary.${transit.id}`, transit.heading); if (narrative) { label('WHAT THIS MEANS FOR YOU'); paragraph(narrative.body); }
    else paragraph(`This is a sustained emphasis in ${transit.lifeArea.toLowerCase()}. Its practical meaning becomes clearest through the exact-hit dates and the choices you make during the active period.`);
  }
  if (significant.length) {
    heading('Additional significant transits');
    for (const item of significant) {
      const transit = presentation.groupedTransits.find((group) => group.id === item.id);
      if (!transit) throw new Error(`missing grouped presentation for ${item.id}`);
      draw(transit.heading.toUpperCase(), 12, bold, rgb(.29,.08,.38), 3);
      draw(`Active: ${item.activePeriod}${item.exactHits.length ? ` · Exact: ${item.exactHits.map((hit) => hit.label).join(', ')}` : ''}`, 9, regular, rgb(.35,.32,.38), 3);
      const narrative = section(`significant.${transit.id}`, transit.heading);
      paragraph(narrative?.body || `${transit.heading} adds meaningful context in ${transit.lifeArea.toLowerCase()}. Work with its exact timing as a reflective checkpoint, without giving it the same weight as the forecast's defining windows.`, 9.5);
    }
  }
  heading('Month by month');
  for (const month of months) {
    ensure(74); draw(month.displayName, 11, bold, rgb(.29,.08,.38), 3);
    const monthNarrative = section(`month.${month.key}`, month.key); if (monthNarrative) paragraph(monthNarrative.body, 9.5); else paragraph(month.primaryInfluences.length ? `This month emphasizes ${month.primaryInfluences.map((item) => item.heading).join(', ')}. Focus on the active themes rather than treating every passing aspect as equally important.` : 'A quieter integration month: make space to consolidate what the stronger periods have already brought into view.', 9.5);
    if (month.primaryInfluences.length) { label('PRIMARY THEMES'); bullet(month.primaryInfluences.map((item) => item.heading).join(' · ')); }
    if (month.keyDates.length) { label('KEY DATES'); month.keyDates.forEach((date) => bullet(date.label)); }
    if (month.secondaryInfluences.length) draw(`Other influences: ${month.secondaryInfluences.map((item) => item.heading).join(' · ')}`, 8.8, regular, rgb(.35,.32,.38), 4);
  }
  heading('Action plan'); const action = section('actions','action'); if (action) paragraph(action.body); else for (const transit of major.slice(0,6)) bullet(`${transit.activePeriod} - use ${transit.heading} to make a practical choice in ${transit.lifeArea.toLowerCase()}.`);
  if (supporting.length) { heading('Supporting influences'); table(['Transit','Active window','Importance','Meaning'],[145,120,75,190],true); supporting.forEach((item) => table([item.heading,item.activePeriod,item.importance,item.meaning],[145,120,75,190],false,4)); }
  heading('How to read this forecast');
  paragraph('Active windows describe the broader period in which a transit is relevant. Exact hits identify the moments the relationship is closest to exact, while applying, return, and separating phases describe how the emphasis develops. Use this forecast as a framework for reflection, timing, and practical decision-making rather than as a literal prediction of events.', 9.5);
  pdf.setTitle(title || 'Yearly Transit Forecast'); pdf.setAuthor('Cosmic Spirit Guide'); pdf.setSubject('Personalized Yearly Transit Forecast'); return pdf.save();
}
