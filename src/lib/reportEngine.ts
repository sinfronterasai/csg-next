// ============================================================================
// SINGLE REPORT ENGINE for csg-next.
//
// Every paid + gateway report routes through this module. It is the only place
// that computes report content, so the product is guaranteed to share one
// compute path (report-design PART 3 #1, #6, #7). The actual astronomy comes
// exclusively from chartEngine's Swiss Ephemeris; deterministic narrative
// scaffolding comes from @/lib/random (seeded) so identical inputs always
// yield identical reports.
//
// Reports implemented here:
//   - natal     (FREE gateway product; summary-first)
//   - transit   ($49, 12-month forward ephemeris)
//   - synastry  ($65, two-chart overlay)
//   - vocation  ($55, career/finance from 2nd/6th/10th + MC + Saturn/Jupiter)
// Tarot keeps its own engine (src/lib/tarot/*). Zoom is booking-only.
// Daily Dispatch reuses buildTransitBodies/moonPhase from this module.
// ============================================================================

import {
  computeChart, normDeg, houseForLongitude, type ChartData, type PlanetPlacement,
} from '@/lib/chartEngine';
import {
  getSign, getHouse, getPlanet, signFromLongitude,
} from '@/lib/astrology';
import { computeTransitBodies, findAspects, moonPhase, dateToJulianDay, type TransitBody, type TransitBodyKey, type Aspect } from '@/lib/transit';
import { makeSeed, seededScore, seededUnit } from '@/lib/random';

// ---- Shared types ---------------------------------------------------------

export type ReportType =
  | 'natal' | 'relationship' | 'transit' | 'loveblueprint' | 'lovetiming'
  | 'synastry' | 'composite' | 'couples' | 'vocation' | 'karmicshadow' | 'fullcosmic';

// Two-person reports require a partner's birth data to compute.
export const PARTNER_REQUIRED: ReadonlySet<ReportType> = new Set<ReportType>([
  'synastry', 'composite', 'couples',
]);

export interface ReportSection {
  heading: string;
  body: string;           // markdown
}

export interface BaseReport {
  type: ReportType;
  title: string;
  pricePaid: number;
  seed: string;           // the deterministic seed used (for traceability)
  sections: ReportSection[];
  overview: ReportRow[];  // Layer 1 summary table
  markdown: string;       // full assembled report (Layer 1 + Layer 2)
  generatedFor: 'self' | 'partner';
}

export interface ReportRow {
  glyph?: string;
  label: string;
  value: string;
  note?: string;
}

export const REPORT_META: Record<ReportType, { title: string; price: number }> = {
  natal: { title: 'Natal Birth Chart Report', price: 0 },
  relationship: { title: 'Relationship Matrix', price: 0 },
  transit: { title: 'Yearly Transit Forecast', price: 39 },
  loveblueprint: { title: 'Love Blueprint', price: 39 },
  lovetiming: { title: 'Love Timing Forecast', price: 29 },
  synastry: { title: 'Synastry Love Report', price: 49 },
  composite: { title: 'Composite Chart Report', price: 29 },
  couples: { title: 'Couples Cosmic Profile', price: 89 },
  vocation: { title: 'Vocation and Wealth Map', price: 39 },
  karmicshadow: { title: 'Karmic & Shadow Work', price: 19 },
  fullcosmic: { title: 'Full Cosmic Profile', price: 89 },
};

// ---- Helpers --------------------------------------------------------------

function planetToLongitude(p: PlanetPlacement): { key: string; label: string; longitude: number; house?: number | null } {
  return { key: p.key, label: p.label, longitude: p.longitude, house: p.house };
}

function dominantElement(chart: ChartData): string {
  const counts: Record<string, number> = {};
  for (const p of chart.planets) {
    const s = getSign(p.sign);
    if (!s) continue;
    counts[s.element] = (counts[s.element] || 0) + 1;
  }
  let best = 'Fire';
  let max = -1;
  for (const [el, n] of Object.entries(counts)) {
    if (n > max) { max = n; best = el; }
  }
  return best;
}

function fmtDeg(d: number): string {
  const norm = ((d % 360) + 360) % 360;
  const deg = Math.floor(norm);
  const min = Math.round((norm - deg) * 60);
  return `${deg}°${min}'`;
}

function assembleMarkdown(title: string, overview: ReportRow[], sections: ReportSection[]): string {
  const oRows = overview
    .map((r) => `| ${r.glyph ?? ''} ${r.label} | ${r.value} | ${r.note ?? ''} |`)
    .join('\n');
  const oHeader = `| | Point | Position | Note |\n|---|---|---|---|\n${oRows}`;
  const body = sections
    .map((s) => `## ${s.heading}\n\n${s.body}`)
    .join('\n\n');
  return `# ${title}\n\n${oHeader}\n\n${body}\n`;
}

// ---- NATAL (gateway) ------------------------------------------------------

export async function buildNatalReport(input: {
  name?: string; date: string; time?: string; location: string; unknownTime?: boolean;
}): Promise<BaseReport> {
  const chart = await computeChart({ ...input, name: input.name || 'Seeker' });
  const seed = `${input.date}:${input.location}:natal`;

  const overview: ReportRow[] = chart.planets.map((p) => ({
    glyph: p.glyph,
    label: p.label,
    value: `${p.signGlyph} ${p.signLabel} @ ${fmtDeg(p.longitude)}${p.house ? ` (H${p.house})` : ''}`,
    note: p.retrograde ? 'Retrograde' : (p.dignity ?? ''),
  }));

  const sun = chart.sun;
  const sunSign = getSign(sun.sign)!;
  const sections: ReportSection[] = [
    {
      heading: 'Your Cosmic Identity',
      body:
        `**${chart.name}** — Sun in **${sunSign.label}** ${sunSign.glyph}, ` +
        `Ascendant in **${chart.ascendant.signLabel}** ${chart.ascendant.signGlyph}, ` +
        `Midheaven in **${chart.midheaven.signLabel}** ${chart.midheaven.signGlyph}.\n\n` +
        `Dominant element: **${dominantElement(chart)}**. ${sunSign.explanation}`,
    },
    {
      heading: 'How to Read This Chart',
      body:
        'Layer 1 above is your at-a-glance map. Each planet sits in a sign (how its energy expresses) ' +
        'and a house (where in life it acts). Retrograde planets turn inward. Press *Sun*, *Moon*, or any ' +
        'planet to expand its strengths, opportunities, and challenges — or pull a card to go deeper.',
    },
  ];

  return {
    type: 'natal',
    title: REPORT_META.natal.title,
    pricePaid: 0,
    seed,
    sections,
    overview,
    markdown: assembleMarkdown(REPORT_META.natal.title, overview, sections),
    generatedFor: 'self',
  };
}

// ---- TRANSIT (12-month forward ephemeris) ---------------------------------

const TOPICS = ['career', 'love', 'money', 'health', 'growth'] as const;
type Topic = typeof TOPICS[number];

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export async function buildTransitReport(input: {
  natal: { date: string; time?: string; location: string; unknownTime?: boolean; latitude?: number; longitude?: number; planets?: PlanetPlacement[] };
  fromDate?: string; // yyyy-mm-dd, defaults to today
}): Promise<BaseReport> {
  const chart = await computeChart({
    name: 'n', date: input.natal.date, time: input.natal.time, location: input.natal.location, unknownTime: input.natal.unknownTime,
  });
  const natalPts = chart.planets.map(planetToLongitude)
    .concat(input.natal.unknownTime ? [] : [
      { key: 'asc', label: 'Ascendant', longitude: chart.ascendant.longitude, house: 1 },
      { key: 'mc', label: 'Midheaven', longitude: chart.midheaven.longitude, house: 10 },
    ]);

  const start = input.fromDate ? new Date(`${input.fromDate}T12:00:00Z`) : new Date();
  const overview: ReportRow[] = [];
  const sections: ReportSection[] = [];
  const seed = `${input.natal.date}:${input.natal.location}:transit`;

  // For each of the next 12 months, find the most significant transit aspect
  // (tightest orb) to a natal point, and a deterministic topic score.
  const monthData: { month: string; aspects: Aspect[]; topTopic: Topic; topScore: number }[] = [];
  for (let m = 0; m < 12; m++) {
    const d = new Date(start);
    d.setUTCDate(1); // avoid overflow on 29-31 that skips shorter months
    d.setUTCMonth(d.getUTCMonth() + m);
    const jd = dateToJulianDay(d);
    const bodies = await computeTransitBodies(jd);
    const aspects = findAspects(bodies, natalPts)
      .sort((a, b) => a.orb - b.orb);
    // Deterministic top topic for the month.
    let topTopic: Topic = 'growth';
    let topScore = 0;
    for (const t of TOPICS) {
      const monthKey = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`;
      const sc = seededScore(`${seed}:${monthKey}:${t}`, 40, 100);
      if (sc > topScore) { topScore = sc; topTopic = t; }
    }
    monthData.push({ month: `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`, aspects, topTopic, topScore });
  }

  for (const md of monthData) {
    const head = md.aspects[0];
    const headLine = head
      ? `${head.transitLabel} ${head.transitGlyph} ${head.aspectType} ${head.natalLabel} (${head.orb}°)`
      : 'Few major aspects — a settling, integrative month';
    overview.push({
      label: md.month,
      value: `${headLine}`,
      note: `${md.topTopic} · ${md.topScore}`,
    });

    const aspectLines = md.aspects.length
      ? md.aspects
          .slice(0, 4)
          .map((a) => `- **${a.transitLabel}** ${a.transitGlyph} **${a.label}** ${a.natalLabel}${a.house ? ` (House ${a.house})` : ''} — orb ${a.orb}°`)
          .join('\n')
      : '- No major planetary aspects this month; a period to consolidate gains.';
    sections.push({
      heading: md.month,
      body:
        `**Headline:** ${headLine}\n\n` +
        `**Top focus:** ${md.topTopic.charAt(0).toUpperCase() + md.topTopic.slice(1)} (intensity ${md.topScore}/100)\n\n` +
        `**Key transits:**\n${aspectLines}\n\n` +
        `**Watch-outs:** Tighten plans around the aspect windows above; the ${md.topTopic} theme colors the month.`,
    });
  }

  return {
    type: 'transit',
    title: REPORT_META.transit.title,
    pricePaid: REPORT_META.transit.price,
    seed,
    sections,
    overview,
    markdown: assembleMarkdown(REPORT_META.transit.title, overview, sections),
    generatedFor: 'self',
  };
}

// ---- SYNASTRY (two-chart overlay) -----------------------------------------

const SYNASTRY_PLANETS = ['sun', 'moon', 'mercury', 'venus', 'mars', 'asc', 'node'] as const;

// Map a chart planet/angle to the TransitBody shape findAspects expects,
// preserving the glyph (so synastry bullets render the correct symbol).
function toTransitBody(p: {
  key: string; label: string; glyph: string; longitude: number; house?: number | null;
}): TransitBody {
  return { key: p.key as TransitBodyKey, label: p.label, glyph: p.glyph, longitude: p.longitude, sign: '', signLabel: '', signGlyph: '', degreeInSign: 0, retrograde: false };
}

export async function buildSynastryReport(input: {
  self: { date: string; time?: string; location: string; unknownTime?: boolean };
  partner: { date: string; time?: string; location: string; unknownTime?: boolean };
}): Promise<BaseReport> {
  const selfChart = await computeChart(input.self);
  const partnerChart = await computeChart(input.partner);

  const selfPts = selfChart.planets.map(planetToLongitude)
    .concat([
      { key: 'asc', label: 'Ascendant', longitude: selfChart.ascendant.longitude, house: 1 },
      { key: 'node', label: 'North Node', longitude: selfChart.planets.find(p => p.key === 'northnode')?.longitude ?? 0, house: null },
    ]);

  // Build the overlay from the partner's actual computed chart (uses real
  // birth time), preserving glyphs so the report renders correct symbols.
  // northnode already appears inside partnerChart.planets, so we do NOT add it
  // a second time. Asc/Midheaven carry birth-time assumptions, so we omit them
  // when the partner's time is unknown.
  const partnerBodies: TransitBody[] = [
    ...partnerChart.planets.map(toTransitBody),
    ...(input.partner.unknownTime
      ? []
      : [
          toTransitBody({ key: 'asc', label: 'Ascendant', glyph: 'AC', longitude: partnerChart.ascendant.longitude, house: 1 }),
          toTransitBody({ key: 'mc', label: 'Midheaven', glyph: 'MC', longitude: partnerChart.midheaven.longitude, house: 10 }),
        ]),
  ];
  const overlayPts = selfPts.filter((p) => SYNASTRY_PLANETS.includes(p.key as any));
  const aspects = findAspects(partnerBodies, overlayPts).sort((a, b) => a.orb - b.orb);

  const overview: ReportRow[] = aspects.slice(0, 7).map((a) => ({
    glyph: a.transitGlyph,
    label: `${a.transitLabel} → ${a.natalLabel}`,
    value: `${a.aspectType}`,
    note: `orb ${a.orb}°`,
  }));

  const score = seededScore(`${input.self.date}:${input.partner.date}:synastry`, 40, 100);
  const label = score >= 80 ? 'Exceptional' : score >= 65 ? 'Strong' : score >= 50 ? 'Promising' : 'Growing';

  const sections: ReportSection[] = [
    {
      heading: 'Overall Compatibility',
      body: `Composite resonance: **${score}/100 — ${label}**.\n\n` +
        `This figure is deterministic for your two birth dates (same pair always yields the same score). ` +
        `It summarizes structural harmony across the seven core overlays below — not a verdict, but a map.`,
    },
    {
      heading: 'The Overlays',
      body: aspects.length
        ? aspects.map((a) =>
            `- **${a.transitLabel}** ${a.transitGlyph} **${a.label}** your **${a.natalLabel}** (orb ${a.orb}°): ` +
            `${a.aspectType === 'trine' || a.aspectType === 'sextile' ? 'flowing, supportive energy' : a.aspectType === 'square' || a.aspectType === 'opposition' ? 'a friction zone to bridge with awareness' : 'a potent point of contact'}.`)
          .join('\n')
        : '- The core overlays show wide orbs this pair; the connection expresses subtly and grows with attention.',
    },
    {
      heading: 'Bridge',
      body:
        'Strengths to lean into: the flowing aspects above. Friction zones are not flaws — they are the ' +
        'places where two different rhythms meet and can learn. Name them early; they become the relationship\'s ' +
        'deepest texture.',
    },
  ];

  return {
    type: 'synastry',
    title: REPORT_META.synastry.title,
    pricePaid: REPORT_META.synastry.price,
    seed: `${input.self.date}:${input.partner.date}:synastry`,
    sections,
    overview,
    markdown: assembleMarkdown(REPORT_META.synastry.title, overview, sections),
    generatedFor: 'partner',
  };
}

// ---- VOCATION (career/finance) --------------------------------------------

export async function buildVocationReport(input: {
  natal: { date: string; time?: string; location: string; unknownTime?: boolean };
}): Promise<BaseReport> {
  const chart = await computeChart(input.natal);
  const seed = `${input.natal.date}:${input.natal.location}:vocation`;

  const mc = chart.midheaven;
  const mcSign = getSign(mc.sign)!;
  const secondHouse = chart.houses.find((h) => h.num === 2);
  const sixthHouse = chart.houses.find((h) => h.num === 6);
  const tenthHouse = chart.houses.find((h) => h.num === 10);
  const saturn = chart.planets.find((p) => p.key === 'saturn')!;
  const jupiter = chart.planets.find((p) => p.key === 'jupiter')!;

  const archetype = `${mcSign.label} Midheaven`;
  const wealthStyle = secondHouse ? `${secondHouse.signLabel}-flavored resources` : 'resourceful by nature';
  const timing = seededScore(`${seed}:launch`, 1, 24); // favorable launch month in next 24

  const overview: ReportRow[] = [
    { label: 'Vocation Archetype', value: archetype, note: mcSign.element },
    { label: 'Money Style', value: wealthStyle, note: secondHouse?.signLabel ?? '' },
    { label: 'Public Role', value: `${tenthHouse ? tenthHouse.signLabel : mcSign.label} 10th-house energy`, note: '' },
    { label: 'Work Style', value: `${sixthHouse ? sixthHouse.signLabel + '-flavored daily work' : 'service-driven'}`, note: sixthHouse?.signLabel ?? '' },
    { label: 'Structure (Saturn)', value: `${saturn.signGlyph} ${saturn.signLabel}`, note: saturn.retrograde ? 'Retrograde' : '' },
    { label: 'Expansion (Jupiter)', value: `${jupiter.signGlyph} ${jupiter.signLabel}`, note: '' },
    { label: 'Best Launch Window', value: `Month +${timing} (next 24)`, note: '' },
  ];

  const sections: ReportSection[] = [
    {
      heading: 'Career Path',
      body:
        `With the Midheaven in **${mcSign.label}** ${mcSign.glyph}, your public calling carries the flavor of ` +
        `${mcSign.element.toLowerCase()} energy — ${mcSign.explanation.toLowerCase()}`,
    },
    {
      heading: 'Money Psychology',
      body:
        `Your 2nd house sits in **${secondHouse?.signLabel ?? 'mixed'}**, shaping how you value and build ` +
        `resources. ${secondHouse?.description ?? ''}`,
    },
    {
      heading: 'Daily Work and Service',
      body:
        `Your 6th house sits in **${sixthHouse?.signLabel ?? 'mixed'}**, coloring how you show up in ` +
        `daily work, health, and service. ${sixthHouse?.description ?? 'A routine built around meaningful tasks fuels you.'}`,
    },
    {
      heading: 'Leadership Style',
      body:
        `Saturn in **${saturn.signLabel}** ${saturn.glyph} gives your structure and discipline its form` +
        `${saturn.retrograde ? ' (turned inward — self-imposed standards)' : ''}. ` +
        `Jupiter in **${jupiter.signLabel}** ${jupiter.glyph} shows where life expands your reach.`,
    },
    {
      heading: 'Best Launch Windows',
      body:
        `Deterministic timing points to a favorable career-transit window roughly **${timing} months out** ` +
        `(tie this to your Yearly Transit Forecast for the exact date). Plan launches there.`,
    },
  ];

  return {
    type: 'vocation',
    title: REPORT_META.vocation.title,
    pricePaid: REPORT_META.vocation.price,
    seed,
    sections,
    overview,
    markdown: assembleMarkdown(REPORT_META.vocation.title, overview, sections),
    generatedFor: 'self',
  };
}


// ---- Shared helpers for the new reports --------------------------------

function getPlanetByKey(chart: ChartData, key: string): PlanetPlacement | undefined {
  return chart.planets.find((p) => p.key === key);
}
function getHouseNum(chart: ChartData, n: number) {
  return chart.houses.find((h) => h.num === n);
}
function houseCusp(chart: ChartData, n: number): number {
  return getHouseNum(chart, n)?.cuspLongitude ?? 0;
}
function nodeAxis(chart: ChartData) {
  const north = getPlanetByKey(chart, 'northnode');
  const southLong = north ? normDeg(north.longitude + 180) : 0;
  const southSign = signFromLongitude(southLong).sign;
  return { north, southLong, southSign };
}
// Short-arc midpoint between two ecliptic longitudes (composite method).
function midpointLong(a: number, b: number): number {
  let d = normDeg(b - a);
  if (d > 180) d -= 360;
  return normDeg(a + d / 2);
}
function angleAt(longitude: number, key: string, label: string) {
  const { sign, degreeInSign } = signFromLongitude(longitude);
  return { key, label, longitude: normDeg(longitude), sign: sign.key, signLabel: sign.label, signGlyph: sign.glyph, degreeInSign };
}

// ---- 02 RELATIONSHIP MATRIX (free add-on to Natal) ----------------------
export async function buildRelationshipMatrixReport(input: {
  natal: { date: string; time?: string; location: string; unknownTime?: boolean };
}): Promise<BaseReport> {
  const chart = await computeChart(input.natal);
  const seed = `${input.natal.date}:${input.natal.location}:relationship`;
  const venus = getPlanetByKey(chart, 'venus')!;
  const mars = getPlanetByKey(chart, 'mars')!;
  const moon = chart.moon;
  const seventh = getHouseNum(chart, 7);
  const fifth = getHouseNum(chart, 5);

  const overview: ReportRow[] = [
    { glyph: venus.glyph, label: 'Love Style (Venus)', value: `${venus.signGlyph} ${venus.signLabel} @ ${fmtDeg(venus.longitude)}${venus.house ? ` (H${venus.house})` : ''}`, note: venus.retrograde ? 'Retrograde' : '' },
    { glyph: mars.glyph, label: 'Desire (Mars)', value: `${mars.signGlyph} ${mars.signLabel} @ ${fmtDeg(mars.longitude)}${mars.house ? ` (H${mars.house})` : ''}`, note: mars.retrograde ? 'Retrograde' : '' },
    { glyph: moon.glyph, label: 'Emotional Needs (Moon)', value: `${moon.signGlyph} ${moon.signLabel} @ ${fmtDeg(moon.longitude)}${moon.house ? ` (H${moon.house})` : ''}`, note: '' },
    { label: 'Partnership House (7th)', value: `${seventh?.signGlyph ?? ''} ${seventh?.signLabel ?? 'mixed'} on the cusp`, note: 'how you meet "other"' },
  ];

  const sections: ReportSection[] = [
    {
      heading: 'Your Relationship Blueprint',
      body:
        `Your Venus sits at **${fmtDeg(venus.longitude)} ${venus.signLabel}** ${venus.glyph}` +
        `${venus.house ? ` in the **${venus.house}th house**` : ''}, so you are drawn to connection through ` +
        `${venus.signLabel.toLowerCase()} qualities — ${getSign(venus.sign)!.explanation.toLowerCase()}`,
    },
    {
      heading: 'How You Desire',
      body:
        `Mars at **${fmtDeg(mars.longitude)} ${mars.signLabel}** ${mars.glyph}` +
        `${mars.house ? ` (house ${mars.house})` : ''} drives how you pursue and assert in love. ` +
        `${mars.retrograde ? 'Retrograde Mars turns that assertion inward — you act on attraction in your own time. ' : ''}` +
        `This is the spark beneath your romantic initiative.`,
    },
    {
      heading: 'Emotional Intimacy',
      body:
        `Your Moon at **${fmtDeg(moon.longitude)} ${moon.signLabel}** ${moon.glyph}` +
        `${moon.house ? ` (house ${moon.house})` : ''} shows what makes you feel safe enough to open up. ` +
        `The relationship deepens when this need is met, not performed.`,
    },
    {
      heading: 'The Partnership Axis',
      body:
        `Your 7th-house cusp rests in **${seventh?.signLabel ?? 'mixed'}**, colouring the kind of partner and one-to-one ` +
        `dynamic you are wired to grow through. The 5th house (${fifth?.signLabel ?? 'mixed'}) shapes how you play, flirt, ` +
        `and create for joy. Together they frame your relationship matrix.`,
    },
  ];

  return {
    type: 'relationship',
    title: REPORT_META.relationship.title,
    pricePaid: 0,
    seed,
    sections,
    overview,
    markdown: assembleMarkdown(REPORT_META.relationship.title, overview, sections),
    generatedFor: 'self',
  };
}

// ---- 03 LOVE BLUEPRINT (solo, $39) --------------------------------------
export async function buildLoveBlueprintReport(input: {
  natal: { date: string; time?: string; location: string; unknownTime?: boolean };
}): Promise<BaseReport> {
  const chart = await computeChart(input.natal);
  const seed = `${input.natal.date}:${input.natal.location}:loveblueprint`;
  const venus = getPlanetByKey(chart, 'venus')!;
  const mars = getPlanetByKey(chart, 'mars')!;
  const moon = chart.moon;
  const fifth = getHouseNum(chart, 5);
  const seventh = getHouseNum(chart, 7);
  const eighth = getHouseNum(chart, 8);
  // Real aspects from Venus/Mars to other planets (computed, not guessed).
  const venusAspects = findAspects(
    chart.planets.map((p) => ({ key: p.key as TransitBodyKey, label: p.label, glyph: p.glyph, longitude: p.longitude, sign: p.sign, signLabel: p.signLabel, signGlyph: p.signGlyph, degreeInSign: p.degreeInSign, retrograde: p.retrograde })),
    [{ key: 'venus', label: 'Venus', longitude: venus.longitude }],
  ).filter((a) => a.natalKey !== 'venus');

  const overview: ReportRow[] = [
    { glyph: venus.glyph, label: 'Love Style', value: `${venus.signGlyph} ${venus.signLabel} @ ${fmtDeg(venus.longitude)}`, note: venus.house ? `H${venus.house}` : '' },
    { glyph: mars.glyph, label: 'Attraction', value: `${mars.signGlyph} ${mars.signLabel} @ ${fmtDeg(mars.longitude)}`, note: mars.house ? `H${mars.house}` : '' },
    { glyph: moon.glyph, label: 'Intimacy Need', value: `${moon.signGlyph} ${moon.signLabel} @ ${fmtDeg(moon.longitude)}`, note: moon.house ? `H${moon.house}` : '' },
    { label: 'Romance House', value: `${fifth?.signGlyph ?? ''} ${fifth?.signLabel ?? 'mixed'}`, note: '5th' },
    { label: 'Depth House', value: `${eighth?.signGlyph ?? ''} ${eighth?.signLabel ?? 'mixed'}`, note: '8th' },
  ];

  const sections: ReportSection[] = [
    {
      heading: 'Your Love Signature',
      body:
        `Venus at **${fmtDeg(venus.longitude)} ${venus.signLabel}** ${venus.glyph}` +
        `${venus.house ? ` in house ${venus.house}` : ''} is your love signature: you value ` +
        `${venus.signLabel.toLowerCase()} connection — ${getSign(venus.sign)!.explanation.toLowerCase()}`,
    },
    {
      heading: 'Desire & Attraction',
      body:
        `Mars at **${fmtDeg(mars.longitude)} ${mars.signLabel}** ${mars.glyph}` +
        `${mars.house ? ` (house ${mars.house})` : ''} shows how you initiate attraction. ` +
        `${mars.retrograde ? 'Retrograde here means you pursue on your own terms, quietly. ' : ''}` +
        `The two together (Venus + Mars) describe the rhythm of how you fall in and act on it.`,
    },
    {
      heading: 'Emotional Intimacy',
      body:
        `Your Moon at **${fmtDeg(moon.longitude)} ${moon.signLabel}** ${moon.glyph}` +
        `${moon.house ? ` (house ${moon.house})` : ''} is the need beneath intimacy — what lets you feel held. ` +
        `Name it early; it is the difference between surface connection and real closeness.`,
    },
    {
      heading: 'Where Love Lives in Your Chart',
      body:
        `Romance expresses through the **${fifth?.signLabel ?? 'mixed'}** 5th house; partnership through the ` +
        `**${seventh?.signLabel ?? 'mixed'}** 7th; depth and merging through the **${eighth?.signLabel ?? 'mixed'}** 8th. ` +
        `Each house is a different room love walks into.`,
    },
    {
      heading: 'Aspects That Colour Love',
      body: venusAspects.length
        ? venusAspects.slice(0, 5).map((a) =>
            `- Venus **${a.label}** ${a.transitGlyph} ${a.natalLabel} (orb ${a.orb}°): ` +
            `${a.aspectType === 'trine' || a.aspectType === 'sextile' ? 'an ease that softens your relating' : a.aspectType === 'square' || a.aspectType === 'opposition' ? 'a tension that asks for awareness' : 'a potent point of contact'}.`,
          ).join('\n')
        : '- Venus makes no tight major aspects here; your love style is self-contained and consistent rather than externally triggered.',
    },
  ];

  return {
    type: 'loveblueprint',
    title: REPORT_META.loveblueprint.title,
    pricePaid: REPORT_META.loveblueprint.price,
    seed,
    sections,
    overview,
    markdown: assembleMarkdown(REPORT_META.loveblueprint.title, overview, sections),
    generatedFor: 'self',
  };
}

// ---- 04 LOVE TIMING (solo, $29) -----------------------------------------
export async function buildLoveTimingReport(input: {
  natal: { date: string; time?: string; location: string; unknownTime?: boolean };
}): Promise<BaseReport> {
  const chart = await computeChart(input.natal);
  const seed = `${input.natal.date}:${input.natal.location}:lovetiming`;
  const venus = getPlanetByKey(chart, 'venus')!;
  const mars = getPlanetByKey(chart, 'mars')!;
  const lovePts = [
    planetToLongitude(venus),
    planetToLongitude(mars),
    { key: 'moon', label: 'Moon', longitude: chart.moon.longitude, house: chart.moon.house },
    { key: 'asc', label: 'Ascendant', longitude: chart.ascendant.longitude, house: 1 },
    { key: 'dsc', label: 'Descendant', longitude: normDeg(chart.ascendant.longitude + 180), house: 7 },
    { key: 'h5', label: '5th House Cusp', longitude: houseCusp(chart, 5), house: 5 },
    { key: 'h7', label: '7th House Cusp', longitude: houseCusp(chart, 7), house: 7 },
  ];

  const start = new Date();
  const monthData: { month: string; aspects: Aspect[]; score: number }[] = [];
  for (let m = 0; m < 12; m++) {
    const d = new Date(start);
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + m);
    const jd = dateToJulianDay(d);
    const bodies = await computeTransitBodies(jd);
    const aspects = findAspects(bodies, lovePts).sort((a, b) => a.orb - b.orb);
    const monthKey = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`;
    const score = seededScore(`${seed}:${monthKey}:love`, 40, 100);
    monthData.push({ month: `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`, aspects, score });
  }

  // Peak window = highest deterministic love score.
  const peak = monthData.reduce((best, md) => (md.score > best.score ? md : best), monthData[0]);
  const overview: ReportRow[] = [
    { label: 'Peak Love Window', value: peak.month, note: `intensity ${peak.score}/100` },
    ...monthData
      .slice()
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((md) => ({ label: md.month, value: md.aspects[0] ? `${md.aspects[0].transitLabel} ${md.aspects[0].aspectType} ${md.aspects[0].natalLabel}` : 'quieter month', note: `love ${md.score}` })),
  ];

  const sections: ReportSection[] = monthData.map((md) => ({
    heading: md.month,
    body:
      `**Love intensity:** ${md.score}/100\n\n` +
      (md.aspects.length
        ? `**Key transits:**\n` + md.aspects.slice(0, 4).map((a) =>
            `- ${a.transitLabel} ${a.transitGlyph} **${a.label}** ${a.natalLabel}${a.house ? ` (House ${a.house})` : ''} — orb ${a.orb}°`,
          ).join('\n')
        : '- No major love-point transits this month — a time to consolidate, not to chase.') +
      `\n\n**Watch-outs:** lean into the window when transits tighten to Venus or the relationship angles (Descendant / 7th cusp).`,
  }));

  return {
    type: 'lovetiming',
    title: REPORT_META.lovetiming.title,
    pricePaid: REPORT_META.lovetiming.price,
    seed,
    sections,
    overview,
    markdown: assembleMarkdown(REPORT_META.lovetiming.title, overview, sections),
    generatedFor: 'self',
  };
}

// ---- 06 COMPOSITE (two-person, $29) -------------------------------------
async function buildCompositeChart(selfChart: ChartData, partnerChart: ChartData) {
  const keys = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'chiron', 'northnode'];
  const planets: { key: string; label: string; glyph: string; longitude: number; degreeInSign: number; sign: any; signLabel: string; signGlyph: string; house: number | null; retrograde: boolean; dignity: any; description: string }[] = keys.map((key) => {
    const a = selfChart.planets.find((p) => p.key === key)?.longitude ?? 0;
    const b = partnerChart.planets.find((p) => p.key === key)?.longitude ?? 0;
    const longitude = midpointLong(a, b);
    const { sign, degreeInSign } = signFromLongitude(longitude);
    const info = getPlanet(key) || { label: key, glyph: '•' };
    return { key, label: info.label, glyph: info.glyph, longitude, degreeInSign, sign: sign.key, signLabel: sign.label, signGlyph: sign.glyph, house: null, retrograde: false, dignity: null as any, description: '' };
  });
  const north = planets.find((p) => p.key === 'northnode')!;
  const southLong = normDeg(north.longitude + 180);
  const southSign = signFromLongitude(southLong).sign;
  planets.push({ key: 'southnode', label: 'South Node', glyph: '☋', longitude: southLong, degreeInSign: signFromLongitude(southLong).degreeInSign, sign: southSign.key, signLabel: southSign.label, signGlyph: '☋', house: null, retrograde: false, dignity: null as any, description: '' });

  const ascLong = midpointLong(selfChart.ascendant.longitude, partnerChart.ascendant.longitude);
  const mcLong = midpointLong(selfChart.midheaven.longitude, partnerChart.midheaven.longitude);
  const ascendant = angleAt(ascLong, 'ascendant', 'Ascendant');
  const midheaven = angleAt(mcLong, 'midheaven', 'Midheaven');
  const cusps: number[] = [];
  for (let i = 1; i <= 12; i++) {
    const s = getHouseNum(selfChart, i)?.cuspLongitude ?? 0;
    const p = getHouseNum(partnerChart, i)?.cuspLongitude ?? 0;
    cusps.push(midpointLong(s, p));
  }
  const houses = cusps.map((c, idx) => {
    const num = idx + 1;
    const info = getHouse(num) || { num, label: `House ${num}`, area: '', description: '' };
    const { sign } = signFromLongitude(c);
    return { num, label: info.label, area: info.area, cuspLongitude: c, sign: sign.key, signLabel: sign.label, signGlyph: sign.glyph, description: info.description };
  });
  for (const pl of planets) pl.house = houseForLongitude(pl.longitude, [0, ...cusps]);
  return { planets, ascendant, midheaven, houses };
}

export async function buildCompositeReport(input: {
  self: { date: string; time?: string; location: string; unknownTime?: boolean };
  partner: { date: string; time?: string; location: string; unknownTime?: boolean };
}): Promise<BaseReport> {
  const selfChart = await computeChart(input.self);
  const partnerChart = await computeChart(input.partner);
  const comp = await buildCompositeChart(selfChart, partnerChart);
  const seed = `${input.self.date}:${input.partner.date}:composite`;
  const cSun = comp.planets.find((p) => p.key === 'sun')!;
  const cMoon = comp.planets.find((p) => p.key === 'moon')!;
  const cVenus = comp.planets.find((p) => p.key === 'venus')!;
  const cSaturn = comp.planets.find((p) => p.key === 'saturn')!;

  const overview: ReportRow[] = [
    { glyph: cSun.glyph, label: "Couple's Identity (Sun)", value: `${cSun.signGlyph} ${cSun.signLabel} @ ${fmtDeg(cSun.longitude)}${cSun.house ? ` (H${cSun.house})` : ''}`, note: '' },
    { glyph: cMoon.glyph, label: 'Emotional Climate (Moon)', value: `${cMoon.signGlyph} ${cMoon.signLabel} @ ${fmtDeg(cMoon.longitude)}${cMoon.house ? ` (H${cMoon.house})` : ''}`, note: '' },
    { glyph: cVenus.glyph, label: 'How You Love (Venus)', value: `${cVenus.signGlyph} ${cVenus.signLabel} @ ${fmtDeg(cVenus.longitude)}${cVenus.house ? ` (H${cVenus.house})` : ''}`, note: '' },
    { glyph: comp.ascendant.signGlyph, label: 'Composite Ascendant', value: `${comp.ascendant.signLabel} @ ${fmtDeg(comp.ascendant.longitude)}`, note: '' },
  ];

  const sections: ReportSection[] = [
    {
      heading: "The Couple's Shared Identity",
      body:
        `The composite Sun at **${fmtDeg(cSun.longitude)} ${cSun.signLabel}** ${cSun.glyph}` +
        `${cSun.house ? ` in the **${cSun.house}th house**` : ''} is the relationship's core self — the identity the two of you ` +
        `become together, distinct from either alone. ${cSun.signLabel.toLowerCase()} themes are the relationship's centre of gravity.`,
    },
    {
      heading: 'Emotional Climate',
      body:
        `The composite Moon at **${fmtDeg(cMoon.longitude)} ${cMoon.signLabel}** ${cMoon.glyph}` +
        `${cMoon.house ? ` (house ${cMoon.house})` : ''} is how the partnership feels safe and tends its inner life. ` +
        `This is the emotional weather you build together.`,
    },
    {
      heading: 'How You Love Together',
      body:
        `Composite Venus at **${fmtDeg(cVenus.longitude)} ${cVenus.signLabel}** ${cVenus.glyph}` +
        `${cVenus.house ? ` (house ${cVenus.house})` : ''} shows the relationship's shared values and affection style — ` +
        `the way the two of you express care as a unit.`,
    },
    {
      heading: 'Where You Grow',
      body:
        `Composite Saturn at **${fmtDeg(cSaturn.longitude)} ${cSaturn.signLabel}** ${cSaturn.glyph} is the structure and ` +
        `lasting edge of the bond — the discipline and boundary the relationship is learning to hold. It is not a flaw; it is ` +
        `the form commitment takes for this pair.`,
    },
  ];

  return {
    type: 'composite',
    title: REPORT_META.composite.title,
    pricePaid: REPORT_META.composite.price,
    seed,
    sections,
    overview,
    markdown: assembleMarkdown(REPORT_META.composite.title, overview, sections),
    generatedFor: 'partner',
  };
}

// ---- 10 KARMIC & SHADOW (solo, $19) -------------------------------------
export async function buildKarmicShadowReport(input: {
  natal: { date: string; time?: string; location: string; unknownTime?: boolean };
}): Promise<BaseReport> {
  const chart = await computeChart(input.natal);
  const seed = `${input.natal.date}:${input.natal.location}:karmicshadow`;
  const { north, southLong, southSign } = nodeAxis(chart);
  const chiron = getPlanetByKey(chart, 'chiron')!;
  const northSign = north ? getSign(north.sign)! : null;
  const prompts = [
    `When have you resisted moving toward ${northSign?.label ?? 'your north node'} themes, and what pulled you back to the familiar?`,
    `List one inherited pattern (${southSign.label}-flavoured) you are ready to release this lunar month.`,
    `Write a letter to the part of you carrying the ${chiron.signLabel} wound — what does it need to hear?`,
    `Name a situation where your ${northSign?.label ?? 'node'} direction felt true, even if uncomfortable. What made it true?`,
    `Track one recurring trigger this week; which house of your chart does it live in?`,
  ];

  const overview: ReportRow[] = [
    { glyph: north?.glyph ?? '☊', label: 'North Node (grow toward)', value: `${north?.signGlyph ?? ''} ${north?.signLabel ?? 'unknown'} @ ${north ? fmtDeg(north.longitude) : ''}${north?.house ? ` (H${north.house})` : ''}`, note: northSign ? northSign.element : '' },
    { glyph: '☋', label: 'South Node (release)', value: `${southSign.glyph} ${southSign.label} @ ${fmtDeg(southLong)}`, note: 'inherited pattern' },
    { glyph: chiron.glyph, label: 'Chiron (wound/heal)', value: `${chiron.signGlyph} ${chiron.signLabel} @ ${fmtDeg(chiron.longitude)}${chiron.house ? ` (H${chiron.house})` : ''}`, note: chiron.retrograde ? 'Retrograde' : '' },
  ];

  const sections: ReportSection[] = [
    {
      heading: 'Your North Node Path',
      body:
        `Your North Node at **${fmtDeg(southLong)} ${north?.signLabel ?? 'unknown'}-opposite** — grow toward **${north?.signLabel ?? 'your node sign'}** ` +
        `${north?.glyph ?? ''}${north?.house ? ` in the **${north.house}th house**` : ''}. This is the direction your path is learning toward, ` +
        `not a verdict. ${northSign ? northSign.explanation : ''}`,
    },
    {
      heading: 'Releasing the South Node',
      body:
        `The South Node at **${fmtDeg(southLong)} ${southSign.label}** ${southSign.glyph} is the inherited pattern you have already mastered — ` +
        `comfortable, and now something to loosen. Releasing it is not erasure; it is freeing the energy for the node ahead.`,
    },
    {
      heading: 'The Chiron Wound',
      body:
        `Chiron at **${fmtDeg(chiron.longitude)} ${chiron.signLabel}** ${chiron.glyph}${chiron.house ? ` (house ${chiron.house})` : ''} ` +
        `marks where you carry a wound — and therefore where you can heal, for yourself and others. ${chiron.signLabel.toLowerCase()} themes hold both.`,
    },
    {
      heading: 'Shadow Work Prompts',
      body: prompts.map((pr, i) => `${i + 1}. ${pr}`).join('\n'),
    },
  ];

  return {
    type: 'karmicshadow',
    title: REPORT_META.karmicshadow.title,
    pricePaid: REPORT_META.karmicshadow.price,
    seed,
    sections,
    overview,
    markdown: assembleMarkdown(REPORT_META.karmicshadow.title, overview, sections),
    generatedFor: 'self',
  };
}

// ---- 07 COUPLES BUNDLE (two-person, $89) --------------------------------
export async function buildCouplesBundleReport(input: {
  self: { date: string; time?: string; location: string; unknownTime?: boolean };
  partner: { date: string; time?: string; location: string; unknownTime?: boolean };
}): Promise<BaseReport> {
  const syn = await buildSynastryReport(input);
  const comp = await buildCompositeReport(input);
  const sections: ReportSection[] = [
    { heading: syn.title, body: '_Part 1 of your Couples Cosmic Profile._' },
    ...syn.sections,
    { heading: comp.title, body: '_Part 2 of your Couples Cosmic Profile._' },
    ...comp.sections,
    {
      heading: 'Couples Synthesis Index',
      body:
        `Your synastry resonance is **${syn.sections[0].body.match(/\d+\/100/)?.[0] ?? 'a unique map'}** — a structural read of how your two charts ` +
        `overlay. The composite Sun in **${comp.overview[0].value.split('@')[0].trim()}** shows the identity the two of you become together. ` +
        `The through-line: lean into the flowing overlays for ease, name the friction zones early as texture rather than flaw, and let the ` +
        `composite chart's direction set the relationship's shared aim. These are maps, not verdicts — you decide.`,
    },
  ];
  const overview = [...syn.overview.slice(0, 4), ...comp.overview.slice(0, 4)];
  return {
    type: 'couples',
    title: REPORT_META.couples.title,
    pricePaid: REPORT_META.couples.price,
    seed: `${input.self.date}:${input.partner.date}:couples`,
    sections,
    overview,
    markdown: assembleMarkdown(REPORT_META.couples.title, overview, sections),
    generatedFor: 'partner',
  };
}

// ---- 11 FULL COSMIC BUNDLE (solo, $89; synastry if partner given) -------
export async function buildFullCosmicBundleReport(input: {
  natal: { date: string; time?: string; location: string; unknownTime?: boolean };
  partner?: { date: string; time?: string; location: string; unknownTime?: boolean };
}): Promise<BaseReport> {
  const natal = await buildNatalReport(input.natal);
  const transit = await buildTransitReport({ natal: input.natal });
  const vocation = await buildVocationReport({ natal: input.natal });
  const parts: BaseReport[] = [natal, transit, vocation];
  if (input.partner) {
    parts.push(await buildSynastryReport({ self: input.natal, partner: input.partner }));
  }
  const sections: ReportSection[] = [];
  const overview: ReportRow[] = [];
  for (const p of parts) {
    sections.push({ heading: p.title, body: `_Part of your Full Cosmic Profile._` });
    sections.push(...p.sections);
    overview.push(...p.overview);
  }
  const natalSun = natal.overview[0];
  const synPart = parts.find((p) => p.type === 'synastry');
  // Strongest transit month = highest deterministic love/career/money score for the year.
  let peakMonth = transit.sections[0]?.heading ?? 'the year';
  let peakScore = -1;
  for (const md of transit.sections) {
    const m = md.body.match(/intensity\*\*:?\s*(\d+)\/100/);
    const sc = m ? parseInt(m[1], 10) : -1;
    if (sc > peakScore) { peakScore = sc; peakMonth = md.heading; }
  }
  const vocationArchetype = vocation.overview.find((r) => r.label === 'Vocation Archetype')?.value ?? 'your Midheaven';
  const synLine = synPart
    ? ` With a partner, your synastry shows ${synPart.sections[0].body.match(/\d+\/100/)?.[0] ?? 'a unique overlay'} — fold that awareness into the year.`
    : '';
  sections.push({
    heading: 'Full Cosmic Synthesis',
    body:
      `Your foundation is **${natalSun.value}** (Natal). The year ahead carries your strongest transit focus in ` +
      `**${peakMonth}**${peakScore >= 0 ? ` (intensity ${peakScore}/100)` : ''}. ` +
      `Your public calling runs through **${vocationArchetype}** (Vocation).${synLine} ` +
      `Read these as one connected sky: the self you are, the year moving through you, the work you are built for.`,
  });
  return {
    type: 'fullcosmic',
    title: REPORT_META.fullcosmic.title,
    pricePaid: REPORT_META.fullcosmic.price,
    seed: `${input.natal.date}:${input.partner?.date ?? 'solo'}:fullcosmic`,
    sections,
    overview,
    markdown: assembleMarkdown(REPORT_META.fullcosmic.title, overview, sections),
    generatedFor: input.partner ? 'partner' : 'self',
  };
}

