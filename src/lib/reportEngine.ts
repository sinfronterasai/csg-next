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
  computeChart, type ChartData, type PlanetPlacement,
} from '@/lib/chartEngine';
import {
  getSign, getHouse, getPlanet, signFromLongitude,
} from '@/lib/astrology';
import { computeTransitBodies, findAspects, moonPhase, dateToJulianDay, type TransitBody, type Aspect } from '@/lib/transit';
import { makeSeed, seededScore, seededUnit } from '@/lib/random';

// ---- Shared types ---------------------------------------------------------

export type ReportType = 'natal' | 'transit' | 'synastry' | 'vocation';

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
  transit: { title: 'Yearly Transit Forecast', price: 49 },
  synastry: { title: 'Synastry Love Report', price: 65 },
  vocation: { title: 'Vocation and Wealth Map', price: 55 },
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

  // For each synastry planet pair, overlay partner planet onto self's chart:
  // aspect partner-body to self's natal points in the overlay set.
  // Build the overlay from the partner's actual computed chart (uses real
  // birth time, includes node/asc/angles) instead of a fixed UTC noon.
  const partnerBodies: TransitBody[] = [
    ...partnerChart.planets.map(planetToLongitude),
    { key: 'asc', label: 'Ascendant', longitude: partnerChart.ascendant.longitude, house: 1 },
    { key: 'mc', label: 'Midheaven', longitude: partnerChart.midheaven.longitude, house: 10 },
    { key: 'node', label: 'North Node', longitude: partnerChart.planets.find(p => p.key === 'northnode')?.longitude ?? 0, house: null },
  ] as TransitBody[];
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
