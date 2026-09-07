// Controlled, server-safe paid natal PDF renderer. The ledger is the immutable,
// deterministic chart snapshot produced by reportFacts; this module only lays it out.
export interface PaidFact { id: string; display: string; value?: any; kind?: string }
export interface NatalLedger { positions: PaidFact[]; houses: any[]; aspects: PaidFact[]; elements: Record<string, number> }
export interface PaidNatalPdfInput { title: string; name: string; birth: { date: string; time: string; location: string }; facts: Record<string, PaidFact>; ledger?: NatalLedger; sections: { heading: string; body: string }[] }
const ANCHOR = /\[\[([^\]]+)\]\]/g;
const safe = (v: unknown) => String(v ?? '').replace(/[°′’]/g, c => c === '°' ? ' deg' : "'").replace(/[^\x20-\x7e]/g, '?');
const pdfText = (v: string) => safe(v).replace(/\\/g, '\\\\').replace(/\(/g, '\\\(').replace(/\)/g, '\\\)');
export function resolveFactAnchors(sections: PaidNatalPdfInput['sections'], facts: Record<string, PaidFact>) {
  const unresolved = new Set<string>();
  const resolved = sections.map(s => ({ ...s, body: s.body.replace(ANCHOR, (_, id: string) => { const f = facts[id]; if (!f?.display?.trim()) { unresolved.add(id); return ''; } return f.display; }) }));
  if (unresolved.size) throw new Error(`unresolved fact anchors: ${[...unresolved].join(', ')}`);
  return { sections: resolved, unresolved: [] as string[] };
}
function lines(text: string, width = 42) { return text.split(/\n/).flatMap(line => { const out: string[] = []; let cur = ''; for (const word of line.split(/\s+/).filter(Boolean)) { if (cur && cur.length + word.length + 1 > width) { out.push(cur); cur = word; } else cur = cur ? `${cur} ${word}` : word; } if (cur || !out.length) out.push(cur); return out; }); }
function point(cx: number, cy: number, radius: number, longitude: number) { const r = (longitude - 90) * Math.PI / 180; return { x: cx + radius * Math.cos(r), y: cy + radius * Math.sin(r) }; }
function text(out: string[], x: number, y: number, value: string, size = 8, color = '0.92 0.93 0.98') { out.push('BT', `/F1 ${size} Tf`, `${color} rg`, `${x} ${y} Td (${pdfText(value)}) Tj`, 'ET'); }
function circle(cx: number, cy: number, r: number) { const k = r * 0.5522848; return `${cx} ${cy+r} m ${cx+k} ${cy+r} ${cx+r} ${cy+k} ${cx+r} ${cy} c ${cx+r} ${cy-k} ${cx+k} ${cy-r} ${cx} ${cy-r} c ${cx-k} ${cy-r} ${cx-r} ${cy-k} ${cx-r} ${cy} c ${cx-r} ${cy+k} ${cx-k} ${cy+r} ${cx} ${cy+r} h S`; }
function wheel(out: string[], ledger: NatalLedger) {
  const cx = 185, cy = 555, outer = 135, zodiac = 120, inner = 94, planets = 105;
  out.push('q', '0.72 0.58 0.26 RG', '0.8 w');
  for (const r of [outer, zodiac, inner]) out.push(circle(cx, cy, r));
  for (let i = 0; i < 12; i++) { const p = point(cx, cy, outer, i * 30); out.push(`${cx} ${cy} m ${p.x} ${p.y} l S`); }
  const zodiacLabels = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
  zodiacLabels.forEach((name, i) => { const p = point(cx, cy, zodiac + 8, i * 30 + 15); text(out, p.x - 9, p.y, name.slice(0, 3), 5.8, '0.86 0.72 0.38'); });
  for (const h of ledger.houses) { const p = point(cx, cy, outer, Number(h.cuspLongitude)); out.push(`${cx} ${cy} m ${p.x} ${p.y} l S`); }
  const aspectFacts = ledger.aspects.filter(a => a.value?.bodyA && a.value?.bodyB);
  out.push('q', '0.75 0.32 0.46 RG', '0.65 w');
  for (const a of aspectFacts) { const pa = ledger.positions.find(p => p.value?.key === a.value.bodyA); const pb = ledger.positions.find(p => p.value?.key === a.value.bodyB); if (pa && pb) { const x = point(cx, cy, inner, pa.value.longitude), y = point(cx, cy, inner, pb.value.longitude); out.push(`${x.x} ${x.y} m ${y.x} ${y.y} l S`); } }
  out.push('Q', 'Q');
  for (const h of ledger.houses) { const p = point(cx, cy, inner - 14, Number(h.cuspLongitude) + 15); text(out, p.x - 4, p.y, String(h.num), 7, '0.78 0.68 0.42'); }
  for (const p of ledger.positions) { if (typeof p.value?.longitude !== 'number') continue; const q = point(cx, cy, planets, p.value.longitude); const label = ({ northnode: 'NNode', southnode: 'SNode', ascendant: 'ASC', descendant: 'DSC', midheaven: 'MC', icumcoeli: 'IC' } as Record<string, string>)[String(p.value.key)] || String(p.value.key || p.id).slice(0, 7); out.push(`${q.x-7} ${q.y-5} 14 10 re S`); text(out, q.x - 6, q.y - 2, label, 5.5, '1 0.8 0.45'); }
}
function pageStream(title: string, body: string[], blueprint = false) {
  const out = ['q', '0.025 0.055 0.16 rg', '0 0 612 792 re f', 'Q', 'q', '0.86 0.72 0.38 RG', '1 w', '42 42 528 708 re S', 'Q'];
  text(out, 58, 730, title, 19, '0.86 0.72 0.38'); let y = 720;
  for (const line of body) { if (y < 70) break; text(out, 58, y, line, 8.3); y -= 12; }
  text(out, 58, 55, 'COSMIC SPIRIT GUIDE  |  PERSONAL NATAL DOSSIER', 7, '0.55 0.63 0.78'); return out.join('\n');
}
function blueprintStream(ledger: NatalLedger) {
  const out = ['q', '0.025 0.055 0.16 rg', '0 0 612 792 re f', 'Q', 'q', '0.86 0.72 0.38 RG', '1 w', '42 42 528 708 re S', 'Q'];
  text(out, 58, 730, 'COSMIC BLUEPRINT', 19, '0.86 0.72 0.38'); wheel(out, ledger);
  text(out, 330, 718, 'PLACEMENTS', 9, '0.86 0.72 0.38'); let y = 704;
  for (const p of ledger.positions) { if (y < 510) break; text(out, 330, y, `${p.value?.label || p.id}  ${p.value?.signLabel || ''}  H${p.value?.house ?? '-'}`, 6.5); y -= 10; }
  text(out, 330, 496, 'ELEMENT BALANCE', 9, '0.86 0.72 0.38'); y = 478;
  for (const [name, count] of Object.entries(ledger.elements)) { text(out, 330, y, `${name.padEnd(6)} ${count}`, 8); out.push('0.78 0.68 0.42 rg', `380 ${y-1} ${Math.max(2, Number(count)*10)} 6 re f`); y -= 16; }
  text(out, 330, 405, '12 HOUSES', 9, '0.86 0.72 0.38'); y = 389;
  for (const h of ledger.houses) { text(out, 330, y, `House ${h.num}: ${h.signLabel || ''} cusp ${Number(h.cuspLongitude).toFixed(1)} deg`, 6.5); y -= 9; }
  text(out, 330, 270, 'ASPECTS', 9, '0.86 0.72 0.38'); text(out, 330, 255, 'ASPECT MODEL: major aspects, 10deg orb', 6.5); if (!ledger.aspects.length) text(out, 330, 241, 'NO VERIFIED ASPECTS IN AUTHORITATIVE LEDGER', 6.5, '0.78 0.78 0.84'); else ledger.aspects.slice(0, 10).forEach((a, i) => text(out, 330, 241 - i*10, a.display, 6.5)); text(out, 58, 55, 'COSMIC SPIRIT GUIDE  |  PERSONAL NATAL DOSSIER', 7, '0.55 0.63 0.78'); return out.join('\n');
}
function makePdf(streams: string[]): Uint8Array { const objects = ['<< /Type /Catalog /Pages 2 0 R >>', `<< /Type /Pages /Kids [${streams.map((_, i) => `${6+i*2} 0 R`).join(' ')}] /Count ${streams.length} >>`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>']; for (const s of streams) objects.push(`<< /Length ${Buffer.byteLength(s)} >>\nstream\n${s}\nendstream`, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${objects.length+1} 0 R >>`); let pdf = '%PDF-1.4\n'; const offsets = [0]; for (const [i, o] of objects.entries()) { offsets.push(Buffer.byteLength(pdf)); pdf += `${i+1} 0 obj\n${o}\nendobj\n`; } const xref = Buffer.byteLength(pdf); pdf += `xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(n => `${String(n).padStart(10,'0')} 00000 n`).join('\n')}\ntrailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`; return new TextEncoder().encode(pdf); }
export function buildPaidNatalPdf(input: PaidNatalPdfInput): Uint8Array { if (!input?.ledger || !Array.isArray(input.ledger.positions) || input.ledger.positions.length < 18) throw new Error('complete natal placement ledger required'); if (!Array.isArray(input.ledger.houses) || input.ledger.houses.length !== 12) throw new Error('12 houses required'); const resolved = resolveFactAnchors(input.sections, input.facts).sections; const cover = ['Cosmic Spirit Guide', input.name, 'A personal reading of your natal sky', `${input.birth.date}  |  ${input.birth.time || 'Time not supplied'}`, input.birth.location, 'PREMIUM NATAL REPORT']; const narrative = resolved.flatMap(s => [s.heading.toUpperCase(), ...lines(s.body), '']); return makePdf([pageStream('COSMIC SPIRIT GUIDE', cover), blueprintStream(input.ledger), pageStream(input.title, narrative)]); }
