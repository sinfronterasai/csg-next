import type { PremiumNatalCompilation } from './deterministicReportCompiler';

// Server-safe Premium Natal PDF renderer. Every visual and prose fact is read
// from the same immutable verified ledger snapshot; this module never computes
// astrology or substitutes scaffold chart data.
export interface PaidFact { id: string; display: string; value?: any; kind?: string }
export interface NatalLedger {
  positions: PaidFact[];
  houses: Array<{ num: number; cuspLongitude: number; signLabel?: string }>;
  aspects: PaidFact[];
  elements: Record<string, number>;
  modalities?: Record<string, number>;
}
export interface PaidNatalPdfInput {
  title: string;
  name: string;
  birth: { date: string; time: string; location: string };
  facts: Record<string, PaidFact>;
  /** Compiled factual skeleton; supplied by the report route, never by n8n. */
  compiledReport?: PremiumNatalCompilation;
  ledger?: NatalLedger;
  sections: { heading: string; body: string }[];
}

type Draw = string[];
type NarrativeLine = { text: string; heading: boolean; paragraph: number; lastInParagraph: boolean };

const ANCHOR = /\[\[([^\]]+)\]\]/g;
const PLANET_KEYS = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
const ANGLE_KEYS = ['ascendant', 'descendant', 'midheaven'];
const ICUMCOELI_KEYS = ['icumcoeli', 'imumcoeli'];
const PAGE_TITLES = [
  '', 'YOUR COSMIC BLUEPRINT', 'YOUR COSMIC BLUEPRINT', 'THE MAIN NARRATIVE',
  'THE MAIN NARRATIVE - CONTINUED', 'YOUR PLANETARY GUIDES', 'YOUR PLANETARY GUIDES - CONTINUED',
  'YOUR PLANETARY GUIDES - CONTINUED', 'GIFTS, TENSIONS & ALIGNMENT', 'PRACTICAL ALIGNMENT PLAN',
  'CLOSING SYNTHESIS',
];

const safe = (value: unknown) => String(value ?? '')
  .replace(/°/g, 'deg').replace(/[′’]/g, "'").replace(/[“”]/g, '"')
  .replace(/[—–]/g, '-').replace(/•/g, '*').replace(/[^\x20-\x7e]/g, '?');
const pdfText = (value: string) => safe(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
const n = (value: number) => Number(value.toFixed(2));

export function resolveFactAnchors(sections: PaidNatalPdfInput['sections'], facts: Record<string, PaidFact>) {
  const unresolved = new Set<string>();
  const resolved = sections.map((section) => ({
    ...section,
    body: section.body.replace(ANCHOR, (_match, id: string) => {
      const fact = facts[id];
      if (!fact?.display?.trim()) { unresolved.add(id); return ''; }
      return fact.display;
    }),
  }));
  if (unresolved.size) throw new Error(`unresolved fact anchors: ${[...unresolved].join(', ')}`);
  return { sections: resolved, unresolved: [] as string[] };
}

function wrap(value: string, width: number): string[] {
  return safe(value).split(/\r?\n/).flatMap((paragraph) => {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) return [''];
    const result: string[] = [];
    let line = '';
    for (const word of words) {
      if (line && line.length + word.length + 1 > width) { result.push(line); line = word; }
      else line = line ? `${line} ${word}` : word;
    }
    if (line) result.push(line);
    return result;
  });
}

function fill(out: Draw, color: string, x: number, y: number, width: number, height: number) {
  out.push('q', `${color} rg`, `${n(x)} ${n(y)} ${n(width)} ${n(height)} re f`, 'Q');
}
function stroke(out: Draw, color: string, width: number, command: string) {
  out.push('q', `${color} RG`, `${width} w`, command, 'Q');
}
function text(out: Draw, x: number, y: number, value: string, size = 9, color = '0.13 0.1 0.2', bold = false) {
  out.push('BT', `/${bold ? 'F2' : 'F1'} ${size} Tf`, `${color} rg`, `1 0 0 1 ${n(x)} ${n(y)} Tm`, `(${pdfText(value)}) Tj`, 'ET');
}
function centered(out: Draw, y: number, value: string, size: number, color: string, bold = false) {
  const x = Math.max(42, 306 - safe(value).length * size * 0.255);
  text(out, x, y, value, size, color, bold);
}
function circle(cx: number, cy: number, radius: number) {
  const k = radius * 0.5522848;
  return `${n(cx)} ${n(cy + radius)} m ${n(cx + k)} ${n(cy + radius)} ${n(cx + radius)} ${n(cy + k)} ${n(cx + radius)} ${n(cy)} c ${n(cx + radius)} ${n(cy - k)} ${n(cx + k)} ${n(cy - radius)} ${n(cx)} ${n(cy - radius)} c ${n(cx - k)} ${n(cy - radius)} ${n(cx - radius)} ${n(cy - k)} ${n(cx - radius)} ${n(cy)} c ${n(cx - radius)} ${n(cy + k)} ${n(cx - k)} ${n(cy + radius)} ${n(cx)} ${n(cy + radius)} c h S`;
}
function point(cx: number, cy: number, radius: number, longitude: number) {
  const radians = (longitude - 90) * Math.PI / 180;
  return { x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians) };
}

function bodyChrome(out: Draw, page: number, title = PAGE_TITLES[page], name = '') {
  fill(out, '0.975 0.957 0.9', 0, 0, 612, 792);
  fill(out, '0.25 0.09 0.36', 0, 782, 612, 10);
  text(out, 42, 756, 'COSMIC SPIRIT GUIDE  *  NATAL CHART STORY', 7.5, '0.31 0.2 0.36', true);
  text(out, 42, 724, title, 18, '0.29 0.08 0.38', true);
  if (name.trim()) text(out, 570 - safe(`FOR ${name}`).length * 3.1, 728, `FOR ${safe(name).toUpperCase()}`, 6.5, '0.42 0.29 0.46', true);
  stroke(out, '0.65 0.52 0.18', 0.7, '42 710 m 570 710 l S');
  text(out, 42, 25, 'COSMIC SPIRIT GUIDE  |  PREMIUM NATAL', 6.5, '0.42 0.34 0.45');
  text(out, 503, 25, `PAGE ${page} OF 10`, 6.5, '0.42 0.34 0.45');
  text(out, 43, 12, 'CREAM BODY', 1, '0.975 0.957 0.9');
}

function coverStream(input: PaidNatalPdfInput) {
  const out: Draw = [];
  fill(out, '0.035 0.026 0.105', 0, 0, 612, 792);
  fill(out, '0.18 0.07 0.28', 0, 782, 612, 10);
  stroke(out, '0.65 0.52 0.18', 0.7, '58 70 m 554 70 l S');
  centered(out, 724, 'COSMIC SPIRIT GUIDE  *  PERSONAL NATAL REPORT', 8, '0.83 0.71 0.42', true);
  const titleLines = wrap(input.title, 30);
  let y = 492 + (titleLines.length - 1) * 14;
  for (const line of titleLines) { centered(out, y, line, 25, '0.98 0.96 0.9', true); y -= 31; }
  centered(out, y - 3, 'Your Personal Natal Chart Story', 10, '0.73 0.62 0.78');
  stroke(out, '0.65 0.52 0.18', 0.7, '246 397 m 366 397 l S');
  centered(out, 370, `${input.birth.date}  *  ${input.birth.time || 'Time not supplied'}`, 9, '0.91 0.88 0.82');
  centered(out, 350, input.birth.location, 9, '0.91 0.88 0.82');
  centered(out, 325, `Prepared for ${input.name}`, 8.5, '0.83 0.71 0.42', true);
  centered(out, 300, 'A narrative interpretation of your unique path,', 8, '0.65 0.6 0.7');
  centered(out, 286, 'gifts, tensions, choices, and practical alignment.', 8, '0.65 0.6 0.7');
  centered(out, 42, 'cosmicspiritguide.com  |  PAGE 1 OF 10', 6.5, '0.52 0.46 0.62');
  text(out, 43, 15, 'DARK EDITORIAL COVER', 1, '0.035 0.026 0.105');
  return out.join('\n');
}

function wheel(out: Draw, ledger: NatalLedger) {
  const cx = 196, cy = 489, outer = 132, zodiac = 113, planetRadius = 92;
  stroke(out, '0.48 0.22 0.55', 0.9, [circle(cx, cy, outer), circle(cx, cy, zodiac), circle(cx, cy, 76)].join('\n'));
  for (let index = 0; index < 12; index++) {
    const boundary = point(cx, cy, outer, index * 30);
    stroke(out, '0.66 0.54 0.25', 0.45, `${cx} ${cy} m ${n(boundary.x)} ${n(boundary.y)} l S`);
    const label = point(cx, cy, 122, index * 30 + 15);
    text(out, label.x - 5, label.y - 2, ['Ar','Ta','Ge','Ca','Le','Vi','Li','Sc','Sg','Cp','Aq','Pi'][index], 6.5, '0.37 0.15 0.44', true);
  }
  for (const house of ledger.houses) {
    const cusp = point(cx, cy, outer, Number(house.cuspLongitude));
    stroke(out, '0.36 0.24 0.4', 0.35, `${cx} ${cy} m ${n(cusp.x)} ${n(cusp.y)} l S`);
    const label = point(cx, cy, 64, Number(house.cuspLongitude) + 15);
    text(out, label.x - 3, label.y - 2, String(house.num), 6.2, '0.42 0.28 0.45');
  }
  for (const aspect of ledger.aspects) {
    const a = ledger.positions.find((fact) => fact.value?.key === aspect.value?.bodyA);
    const b = ledger.positions.find((fact) => fact.value?.key === aspect.value?.bodyB);
    if (!a || !b) continue;
    const pa = point(cx, cy, 74, Number(a.value.longitude));
    const pb = point(cx, cy, 74, Number(b.value.longitude));
    const flowing = ['trine', 'sextile'].includes(String(aspect.value?.aspectType));
    stroke(out, flowing ? '0.18 0.45 0.52' : '0.7 0.2 0.35', 0.65, `${n(pa.x)} ${n(pa.y)} m ${n(pb.x)} ${n(pb.y)} l S`);
  }
  for (const fact of ledger.positions) {
    if (typeof fact.value?.longitude !== 'number') continue;
    const p = point(cx, cy, planetRadius, fact.value.longitude);
    const key = String(fact.value?.key || '');
    const label = ({ ascendant: 'ASC', descendant: 'DSC', midheaven: 'MC', imumcoeli: 'IC' } as Record<string, string>)[key] || key.slice(0, 2).toUpperCase();
    fill(out, '0.975 0.957 0.9', p.x - 8, p.y - 6, 16, 12);
    stroke(out, '0.46 0.2 0.52', 0.4, `${n(p.x - 8)} ${n(p.y - 6)} 16 12 re S`);
    text(out, p.x - 6.5, p.y - 2.3, label, 5.2, '0.32 0.1 0.4', true);
  }
}

function blueprintStream(input: PaidNatalPdfInput, ledger: NatalLedger) {
  const out: Draw = [];
  bodyChrome(out, 2, PAGE_TITLES[2], input.name);
  text(out, 42, 692, 'YOUR VERIFIED CHART AT A GLANCE', 8, '0.33 0.1 0.42', true);
  text(out, 42, 679, 'Verified geometry: 12 houses, natal placements, angles, and selected major aspects.', 8, '0.31 0.25 0.34');
  wheel(out, ledger);
  text(out, 354, 665, 'CHART SIGNATURE', 8, '0.33 0.1 0.42', true);
  const signatures = ledger.positions.filter((fact) => ['ascendant', 'sun', 'moon'].includes(String(fact.value?.key)));
  let y = 648;
  for (const fact of signatures) { for (const line of wrap(fact.display, 38)) { text(out, 354, y, line, 7.1); y -= 10; } y -= 4; }
  text(out, 354, y - 3, 'ELEMENT BALANCE', 8, '0.33 0.1 0.42', true); y -= 21;
  for (const [label, count] of Object.entries(ledger.elements)) {
    text(out, 354, y, `${label} ${count}`, 7.2, '0.2 0.16 0.24', true);
    fill(out, '0.49 0.26 0.55', 414, y - 1, Math.max(5, Number(count) * 15), 6);
    stroke(out, '0.73 0.62 0.3', 0.35, `${n(414 + Math.max(5, Number(count) * 15))} ${n(y - 1)} m ${n(414 + Math.max(5, Number(count) * 15))} ${n(y + 5)} l S`); y -= 14;
  }
  text(out, 354, y, 'MODALITY', 7.2, '0.33 0.1 0.42', true); y -= 13;
  for (const [label, count] of Object.entries(ledger.modalities || {})) { text(out, 354, y, `${label} ${count}`, 7.2); y -= 12; }
  text(out, 354, y - 5, 'ASPECT NETWORK', 8, '0.33 0.1 0.42', true); y -= 20;
  for (const [index, fact] of ledger.aspects.slice(0, 4).entries()) {
    const flowing = ['trine', 'sextile'].includes(String(fact.value?.aspectType));
    fill(out, flowing ? '0.18 0.45 0.52' : '0.7 0.2 0.35', 354, y - 3, 6, 6);
    for (const line of wrap(fact.display, 40)) { text(out, 366, y, line, 6.2, '0.2 0.16 0.24', index === 0); y -= 9; }
    y -= 3;
  }
  text(out, 42, 322, 'HOUSE CUSPS', 8, '0.33 0.1 0.42', true);
  y = 305;
  for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) {
    const house = ledger.houses[row * 4 + col];
    text(out, 42 + col * 132, y - row * 19, `House ${house.num}: ${house.signLabel || ''} ${n(house.cuspLongitude)}deg`, 6.5);
  }
  return out.join('\n');
}

function narrativeLines(input: PaidNatalPdfInput): NarrativeLine[] {
  const resolved = resolveFactAnchors(input.sections, input.facts).sections;
  const result: NarrativeLine[] = [];
  for (const [paragraph, section] of resolved.entries()) {
    const originalBody = section.body.trim();
    const body = originalBody.replace(/(?:^|\s+)equilibrium[.!]?$/i, '').trim();
    if (/^equilibrium[.!]?$/i.test(originalBody)) continue;
    result.push({ text: safe(section.heading).toUpperCase(), heading: true, paragraph, lastInParagraph: false });
    const lines = wrap(body, 88);
    lines.forEach((line, index) => result.push({ text: line, heading: false, paragraph, lastInParagraph: index === lines.length - 1 }));
    result.push({ text: '', heading: false, paragraph, lastInParagraph: true });
  }
  return result;
}

export function buildJourneySynthesis(input: PaidNatalPdfInput): string {
  const ledger = validateLedger(input);
  const dominantElement = Object.entries(ledger.elements).sort((a, b) => b[1] - a[1])[0];
  const sun = ledger.positions.find((fact) => fact.value?.key === 'sun');
  const moon = ledger.positions.find((fact) => fact.value?.key === 'moon');
  const tension = ledger.aspects.find((fact) => ['square', 'opposition'].includes(String(fact.value?.aspectType)));
  const drive = ledger.aspects.find((fact) => fact.value?.bodyA === 'mars' && fact.value?.bodyB === 'jupiter')
    || ledger.aspects.find((fact) => ['conjunction', 'trine', 'sextile'].includes(String(fact.value?.aspectType)));
  const placement = [sun?.display, moon?.display].filter(Boolean).join(' and ');
  return `${input.name}'s journey is anchored by ${placement}. With ${dominantElement?.[1] ?? 0} ${dominantElement?.[0] ?? 'balanced'} signatures in the verified element balance, sensitivity becomes useful when it is given a repeatable form. ${tension ? `${tension.display} names the inner friction: hold both needs in view instead of choosing one too quickly. ` : ''}${drive ? `${drive.display} supplies a constructive route forward: turn the chart's capacity into a practice that can be tested in real life. ` : ''}The closing move is integration - let meaning set the direction, let evidence shape the next step, and let boundaries protect the work as it grows.`;
}

function pageModules(out: Draw, page: number, ledger: NatalLedger, input: PaidNatalPdfInput): number {

  if (page === 3) {
    text(out, 42, 687, 'Placement', 7, '0.34 0.1 0.42', true);
    text(out, 240, 687, 'Verified position', 7, '0.34 0.1 0.42', true);
    let y = 670;
    for (const fact of ledger.positions.slice(0, 7)) { text(out, 42, y, String(fact.value?.label || fact.id), 7, '0.18 0.14 0.22', true); text(out, 150, y, fact.display, 6.8); y -= 18; }
    stroke(out, '0.72 0.63 0.78', 0.4, '42 535 m 570 535 l S');
    return 515;
  }
  if (page === 4) {
    let y = 686;
    for (const fact of ledger.positions.slice(7)) { text(out, 42, y, String(fact.value?.label || fact.id), 7, '0.18 0.14 0.22', true); text(out, 150, y, fact.display, 6.8); y -= 18; }
    text(out, 42, y - 3, 'THE MAIN NARRATIVE', 9, '0.34 0.1 0.42', true);
    return y - 25;
  }
  if (page >= 5 && page <= 7) {
    // Keep the opener useful and distribute the ten planets before the four angles.
    // The final page absorbs the angles, rather than leaving a title-only opener.
    const ranges: Record<number, [number, number]> = { 5: [0, 4], 6: [4, 8], 7: [8, 14] };
    const [start, end] = ranges[page];
    let y = page === 5 ? 665 : 687;
    if (page === 5) {
      text(out, 42, 696, 'INTEGRATION PATHWAY', 9, '0.34 0.1 0.42', true);
      text(out, 42, 682, 'Read each verified placement as a choice to notice, test, and refine.', 7.2, '0.28 0.23 0.3');
    }
    for (const fact of ledger.positions.slice(start, end)) {
      fill(out, '0.94 0.91 0.84', 42, y - 31, 528, 38);
      text(out, 54, y - 5, fact.display, 7.2, '0.31 0.1 0.4', true);
      const key = String(fact.value?.key || 'placement');
      const prompt = key === 'sun' ? 'Gift: identity and purpose. Practice: name the value this placement serves.'
        : key === 'moon' ? 'Gift: emotional attunement. Practice: pause and record the signal before responding.'
        : key === 'mars' ? 'Gift: initiative. Practice: choose one bounded action and finish its first version.'
        : key === 'jupiter' ? 'Gift: growth. Practice: expand only where evidence supports the next step.'
        : key === 'ascendant' ? 'Gift: visible approach. Practice: let the first behavior match the inner intention.'
        : 'Gift: a distinct way of perceiving. Practice: reflect, choose, test, and refine.';
      text(out, 54, y - 19, prompt, 6.4, '0.28 0.23 0.3');
      y -= 45;
    }
    return y - 5;
  }
  if (page === 8) {
    const sun = ledger.positions.find((fact) => fact.value?.key === 'sun');
    const moon = ledger.positions.find((fact) => fact.value?.key === 'moon');
    const mars = ledger.positions.find((fact) => fact.value?.key === 'mars');
    const jupiter = ledger.positions.find((fact) => fact.value?.key === 'jupiter');
    const tension = ledger.aspects.find((fact) => ['square', 'opposition'].includes(String(fact.value?.aspectType)));
    const flowing = ledger.aspects.find((fact) => ['trine', 'sextile'].includes(String(fact.value?.aspectType)));
    text(out, 42, 687, 'YOUR CENTRAL GIFTS', 9, '0.34 0.1 0.42', true);
    const gifts = [
      `${sun?.display || 'Verified Sun placement'} - purpose you can articulate`,
      `${mars?.display || 'Verified Mars placement'} with ${jupiter?.display || 'verified Jupiter placement'} - constructive momentum`,
      `${flowing?.display || 'Verified flowing aspect'} - ease that grows through practice`,
    ];
    let y = 669;
    for (const gift of gifts) { fill(out, '0.88 0.94 0.91', 42, y - 11, 528, 20); text(out, 54, y - 3, gift, 6.8, '0.18 0.3 0.28'); y -= 25; }
    text(out, 42, y - 4, 'YOUR RECURRING TENSIONS', 9, '0.34 0.1 0.42', true); y -= 22;
    const tensions = [
      tension?.display || 'Verified tension aspect - hold both needs in view',
      `${moon?.display || 'Verified Moon placement'} - sensitivity needs a clear boundary`,
      'Vision and refinement - test a real version before perfecting it',
    ];
    for (const item of tensions) { fill(out, '0.97 0.9 0.88', 42, y - 11, 528, 20); text(out, 54, y - 3, item, 6.8, '0.36 0.18 0.2'); y -= 25; }
    text(out, 42, y - 4, 'PRACTICAL ALIGNMENT PLAN', 9, '0.34 0.1 0.42', true);
    text(out, 42, y - 21, 'A four-part loop: notice the signal, choose a bounded action, review evidence, refine.', 7, '0.22 0.18 0.26');
    stroke(out, '0.65 0.52 0.18', 0.7, `42 ${n(y - 39)} m 570 ${n(y - 39)} l S`);
    return y - 52;
  }
  if (page === 9) {
    const sun = ledger.positions.find((fact) => fact.value?.key === 'sun');
    const moon = ledger.positions.find((fact) => fact.value?.key === 'moon');
    const ascendant = ledger.positions.find((fact) => fact.value?.key === 'ascendant');
    const tension = ledger.aspects.find((fact) => ['square', 'opposition'].includes(String(fact.value?.aspectType)));
    text(out, 42, 687, 'A CHART-GROUNDED FOUR-WEEK LOOP', 9, '0.34 0.1 0.42', true);
    const plan: Array<[string, string]> = [
      ['WEEK 1 - NOTICE', `${sun?.display || 'Verified Sun placement'}: write one value to guide the decision.`],
      ['WEEK 2 - REGULATE', `${moon?.display || 'Verified Moon placement'}: name the signal and set one boundary.`],
      ['WEEK 3 - ACT', `${ascendant?.display || 'Verified Ascendant placement'}: take one visible, time-boxed action.`],
      ['WEEK 4 - REVIEW', `${tension?.display || 'Verified tension aspect'}: compare evidence, then keep or revise.`],
    ];
    let y = 666;
    for (const [label, instruction] of plan) {
      fill(out, '0.94 0.91 0.84', 42, y - 34, 528, 43);
      text(out, 56, y - 10, label, 7.1, '0.34 0.1 0.42', true);
      for (const [index, line] of wrap(instruction, 82).slice(0, 2).entries()) text(out, 176, y - 10 - index * 9, line, 6.7, '0.22 0.18 0.26');
      y -= 51;
    }
    return y - 5;
  }
  if (page === 10) {
    const sun = ledger.positions.find((fact) => fact.value?.key === 'sun');
    const moon = ledger.positions.find((fact) => fact.value?.key === 'moon');
    const ascendant = ledger.positions.find((fact) => fact.value?.key === 'ascendant');
    const tension = ledger.aspects.find((fact) => ['square', 'opposition'].includes(String(fact.value?.aspectType)));
    const steps: Array<[string, string, string]> = [
      ['01 NOTICE', sun?.display || 'Verified Sun placement', 'Write the value or purpose you want the next decision to serve.'],
      ['02 REGULATE', moon?.display || 'Verified Moon placement', 'Name the emotional signal and one boundary before committing.'],
      ['03 ACT', ascendant?.display || 'Verified Ascendant placement', 'Take one visible, time-boxed action that makes the intention real.'],
      ['04 REVIEW', tension?.display || 'Verified chart tension', 'After the test, keep what produced evidence and revise what created friction.'],
    ];
    let y = 687;
    for (const [label, fact, instruction] of steps) {
      fill(out, '0.94 0.91 0.84', 42, y - 43, 528, 52);
      text(out, 56, y - 11, label, 7.3, '0.34 0.1 0.42', true);
      text(out, 145, y - 11, fact, 6.8, '0.18 0.14 0.22', true);
      for (const [index, line] of wrap(instruction, 78).slice(0, 2).entries()) text(out, 56, y - 27 - index * 9, line, 6.6, '0.28 0.23 0.3');
      y -= 63;
    }
    text(out, 42, y - 4, 'CLOSING SYNTHESIS', 11, '0.34 0.1 0.42', true);
    let closingY = y - 28;
    for (const line of wrap(buildJourneySynthesis(input), 88)) { text(out, 42, closingY, line, 7.25, '0.16 0.13 0.2'); closingY -= 10.2; }
    return closingY - 8;
  }
  return 687;
}

function bodyStreams(input: PaidNatalPdfInput, ledger: NatalLedger): string[] {
  const content = narrativeLines(input);
  const streams: string[] = [];
  let cursor = 0;
  const footerBoundary = 55;
  for (let index = 0; index < 8; index++) {
    const page = index + 3;
    const out: Draw = [];
    bodyChrome(out, page, PAGE_TITLES[page], input.name);
    let y = pageModules(out, page, ledger, input);
    while (cursor < content.length) {
      const line = content[cursor];
      const height = line.heading ? 13 : 10.2;
        // Never leave a paragraph's final line alone at the bottom of a page.
        if (!line.heading && line.lastInParagraph && y - height < footerBoundary + 10.2) break;
      if (y - height < footerBoundary) break;
      if (line.heading) text(out, 42, y, line.text, 8.2, '0.35 0.1 0.43', true);
      else text(out, 42, y, line.text, 7.25, '0.16 0.13 0.2');
      y -= height;
      cursor += 1;
    }
    streams.push(out.join('\n'));
  }
  if (cursor !== content.length) throw new Error(`premium narrative exceeds ten-page capacity (${content.length - cursor} lines remain)`);
  return streams;
}

function validateLedger(input: PaidNatalPdfInput): NatalLedger {
  const ledger = input.ledger;
  if (!ledger || !Array.isArray(ledger.positions)) throw new Error('verified natal ledger required');
  const keys = new Set(ledger.positions.map((fact) => String(fact.value?.key)));
  if (!PLANET_KEYS.every((key) => keys.has(key)) || !ANGLE_KEYS.every((key) => keys.has(key)) || !ICUMCOELI_KEYS.some((key) => keys.has(key))) throw new Error('ten planets and four angles required');
  if (!Array.isArray(ledger.houses) || ledger.houses.length !== 12 || ledger.houses.some((house, index) => house.num !== index + 1 || !Number.isFinite(house.cuspLongitude))) throw new Error('12 houses required');
  if (!Array.isArray(ledger.aspects) || ledger.aspects.length === 0 || ledger.aspects.some((fact) => !fact.display || !fact.value?.bodyA || !fact.value?.bodyB)) throw new Error('verified aspects required');
  for (const fact of ledger.positions) {
    if (!fact.id || !fact.display || !Number.isFinite(fact.value?.longitude)) throw new Error('complete verified placement required');
    const authoritative = input.facts[fact.id];
    if (!authoritative || authoritative.display !== fact.display) throw new Error(`ledger/fact divergence: ${fact.id}`);
  }
  return ledger;
}

function makePdf(streams: string[], input: PaidNatalPdfInput): Uint8Array {
  const pageIds = streams.map((_stream, index) => 7 + index * 2);
  const objects: string[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${streams.length} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold /Encoding /WinAnsiEncoding >>',
    `<< /Title (${pdfText(input.title)}) /Author (Cosmic Spirit Guide) /Subject (Personal Natal Chart Story) /Creator (Cosmic Spirit Guide Premium Natal Engine) /Producer (Cosmic Spirit Guide deterministic PDF engine) >>`,
  ];
  for (const stream of streams) {
    const streamId = objects.length + 1;
    objects.push(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${streamId} 0 R >>`);
  }

  let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += `${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n`).join('\n')}\n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Uint8Array.from(Buffer.from(pdf, 'latin1'));
}

export function buildPaidNatalPdf(input: PaidNatalPdfInput): Uint8Array {
  const ledger = validateLedger(input);
  const streams = [coverStream(input), blueprintStream(input, ledger), ...bodyStreams(input, ledger)];
  if (streams.length !== 10) throw new Error('premium natal architecture must contain exactly 10 pages');
  return makePdf(streams, input);
}
