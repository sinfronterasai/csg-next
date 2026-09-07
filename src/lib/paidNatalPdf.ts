// Server-safe paid natal PDF renderer. It deliberately does not use window.print:
// the returned bytes have no browser-generated headers, footers, or URL metadata.

export interface PaidFact { id: string; display: string; value?: unknown; kind?: string }
export interface PaidNatalPdfInput {
  title: string;
  name: string;
  birth: { date: string; time: string; location: string };
  facts: Record<string, PaidFact>;
  sections: { heading: string; body: string }[];
}

const ANCHOR = /\[\[([^\]]+)\]\]/g;
const safe = (v: unknown) => String(v ?? '').replace(/[°′’]/g, (c) => c === '°' ? ' deg' : "'").replace(/[^\x20-\x7e]/g, '?');
const pdfText = (v: string) => safe(v).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

export function resolveFactAnchors(
  sections: PaidNatalPdfInput['sections'], facts: Record<string, PaidFact>,
): { sections: PaidNatalPdfInput['sections']; unresolved: string[] } {
  const unresolved = new Set<string>();
  const resolved = sections.map((section) => ({
    heading: section.heading,
    body: section.body.replace(ANCHOR, (_, id: string) => {
      const fact = facts[id];
      if (!fact || typeof fact.display !== 'string' || fact.display.trim() === '') {
        unresolved.add(id);
        return '';
      }
      return fact.display;
    }),
  }));
  if (unresolved.size) throw new Error(`unresolved fact anchors: ${[...unresolved].join(', ')}`);
  return { sections: resolved, unresolved: [] };
}

function lines(text: string, width = 84): string[] {
  return text.split(/\n/).flatMap((line) => {
    const words = line.split(/\s+/).filter(Boolean); const out: string[] = []; let current = '';
    for (const word of words) { if (current && current.length + word.length + 1 > width) { out.push(current); current = word; } else current = current ? `${current} ${word}` : word; }
    if (current || !out.length) out.push(current); return out;
  });
}

function pageStream(title: string, body: string[], blueprint = false): string {
  const out = ['q', '0.025 0.055 0.16 rg', '0 0 612 792 re f', 'Q', 'q', '0.86 0.72 0.38 RG', '1.2 w', '42  forty?'];
  out.pop(); out.push('42 42 528 708 re S', 'Q', 'BT', '/F2 24 Tf', '0.86 0.72 0.38 rg', `60 730 Td (${pdfText(title)}) Tj`, 'ET');
  let y = 688;
  if (blueprint) {
    out.push('q', '0.45 0.38 0.22 RG', '1 w');
    for (const r of [105, 150, 195]) {
      const k = 0.5522848 * r;
      out.push(`306 ${570 + r} m ${306 + k} ${570 + r} ${306 + r} ${570 + k} ${306 + r} 570 c ${306 + r} ${570 - k} ${306 + k} ${570 - r} 306 ${570 - r} c ${306 - k} ${570 - r} ${306 - r} ${570 - k} ${306 - r} 570 c ${306 - r} ${570 + k} ${306 - k} ${570 + r} 306 ${570 + r} h S`);
    }
    // Deliberate print-safe wheel: concentric rings plus deterministic spokes.
    for (const [x1, y1, x2, y2] of [[306,570,306,765],[306,570,501,570],[306,570,306,375],[306,570,111,570],[306,570,444,708],[306,570,168,708]]) out.push(`${x1} ${y1} m ${x2} ${y2} l S`);
    out.push('Q');
    y = 330;
  }
  for (const line of body) { if (y < 70) break; out.push('BT', '/F1 10 Tf', '0.92 0.93 0.98 rg', `60 ${y} Td (${pdfText(line)}) Tj`, 'ET'); y -= 16; }
  out.push('BT', '/F1 8 Tf', '0.55 0.63 0.78 rg', `60 56 Td (${pdfText('COSMIC SPIRIT GUIDE  |  PERSONAL NATAL DOSSIER')}) Tj`, 'ET');
  return out.join('\n');
}

function makePdf(streams: string[]): Uint8Array {
  const objects: string[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${streams.map((_, i) => `${6 + i * 2} 0 R`).join(' ')}] /Count ${streams.length} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
  ];
  for (const stream of streams) objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${objects.length + 1} 0 R >>`);
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((obj, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`; });
  const xref = pdf.length; pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((n) => `${String(n).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

export function buildPaidNatalPdf(input: PaidNatalPdfInput): Uint8Array {
  if (!input || !Array.isArray(input.sections) || !input.facts) throw new Error('paid natal PDF input incomplete');
  const resolved = resolveFactAnchors(input.sections, input.facts).sections;
  const facts = Object.values(input.facts);
  const positions = facts.filter((f) => f.kind === 'position' || /position/.test(f.id)).slice(0, 14).map((f) => f.display);
  const elementFor = (sign: string) => ({ Aries: 'Fire', Leo: 'Fire', Sagittarius: 'Fire', Taurus: 'Earth', Virgo: 'Earth', Capricorn: 'Earth', Gemini: 'Air', Libra: 'Air', Aquarius: 'Air', Cancer: 'Water', Scorpio: 'Water', Pisces: 'Water' } as Record<string, string>)[sign];
  const elements = ['Fire', 'Earth', 'Air', 'Water'].map((element) => `${element}: ${facts.filter((f) => elementFor(String((f.value as any)?.signLabel)) === element).length}`).join('   ');
  const aspects = facts.filter((f) => f.kind === 'aspect' || /aspect/.test(f.id)).slice(0, 8).map((f) => f.display);
  const aspectLines = aspects.length ? aspects : ['No major aspects in the verified natal ledger.'];
  const cover = ['Cosmic Spirit Guide', input.name, 'A personal reading of your natal sky', '', `${input.birth.date}  |  ${input.birth.time || 'Time not supplied'}`, input.birth.location, '', 'PREMIUM NATAL REPORT'];
  const blueprint = ['PLACEMENTS', ...positions, '', 'ELEMENT BALANCE', elements, '', 'ASPECTS', ...aspectLines];
  const narrative = resolved.flatMap((s) => [`${s.heading.toUpperCase()}`, ...lines(s.body), '']);
  return makePdf([pageStream('COSMIC SPIRIT GUIDE', cover), pageStream('COSMIC BLUEPRINT', blueprint, true), pageStream(input.title, narrative)]);
}
