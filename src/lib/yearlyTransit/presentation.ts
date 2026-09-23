import type { ActiveWindow, ImportanceBand, YearlyTransitFactPack } from './types';

export type CustomerImportance = 'Very High' | 'High' | 'Moderate' | 'Supporting';
export type CustomerPhase = 'Applying' | 'Exact hit' | 'Retrograde return' | 'Separating / integration' | 'Active';

export interface PresentationPhase {
  label: CustomerPhase;
  startUtc: string;
  endUtc: string;
  exactHits: string[];
  directions: string[];
  retrograde: boolean;
}

export interface PresentationExactHit { utc: string; direction: string; retrograde: boolean }

export interface GroupedTransitPresentation {
  id: string;
  mover: string;
  target: string;
  aspect: string;
  heading: string;
  activeStartUtc: string;
  activeEndUtc: string;
  importance: CustomerImportance;
  importanceScore: number;
  lifeArea: string;
  house: number | null;
  exactHits: PresentationExactHit[];
  phases: PresentationPhase[];
  evidenceIds: string[];
  passCount: number;
  retrograde: boolean;
}

export interface MonthlyPresentation {
  key: string;
  label: string;
  transitIds: string[];
  summary: 'Active transit themes' | 'Integration and consolidation';
}

export interface AppendixPresentation {
  id: string;
  transit: string;
  startUtc: string;
  endUtc: string;
  importance: CustomerImportance;
  meaning: string;
  evidenceIds: string[];
}

export interface YearlyTransitPresentation {
  periodStartUtc: string;
  periodEndUtc: string;
  timezone: string;
  groupedTransits: GroupedTransitPresentation[];
  monthly: MonthlyPresentation[];
  appendix: AppendixPresentation[];
}

export interface CustomerYearlyTransitPresentation {
  periodLabel: string;
  groupedTransits: Array<{ id: string; heading: string; activePeriod: string; importance: CustomerImportance; lifeArea: string; exactHits: string[]; phases: Array<{ label: CustomerPhase; period: string }>; passCount: number }>;
  monthly: Array<{ key: string; label: string; transitNames: string[]; summary: MonthlyPresentation['summary'] }>;
  appendix: Array<{ id: string; transit: string; activePeriod: string; importance: CustomerImportance; meaning: string }>;
}

const BODY_NAMES: Record<string, string> = { sun: 'Sun', moon: 'Moon', mercury: 'Mercury', venus: 'Venus', mars: 'Mars', jupiter: 'Jupiter', saturn: 'Saturn', uranus: 'Uranus', neptune: 'Neptune', pluto: 'Pluto' };
const TARGET_NAMES: Record<string, string> = { sun: 'Sun', moon: 'Moon', mercury: 'Mercury', venus: 'Venus', mars: 'Mars', jupiter: 'Jupiter', saturn: 'Saturn', uranus: 'Uranus', neptune: 'Neptune', pluto: 'Pluto', asc: 'Ascendant', mc: 'Midheaven', northnode: 'True North Node', chiron: 'Chiron' };
const ASPECT_NAMES: Record<string, string> = { conjunction: 'Conjunct', sextile: 'Sextile', square: 'Square', trine: 'Trine', opposition: 'Opposite' };
const BAND_NAMES: Record<ImportanceBand, CustomerImportance> = { defining: 'Very High', major: 'High', meaningful: 'Moderate', supporting: 'Supporting', omit: 'Supporting' };

export function displayBody(key: string): string { return BODY_NAMES[key] || titleWords(key); }
export function displayTarget(key: string): string { return TARGET_NAMES[key] || titleWords(key); }
export function displayAspect(key: string): string { return ASPECT_NAMES[key] || titleWords(key); }
export function displayTransit(window: Pick<ActiveWindow, 'mover' | 'target' | 'aspectType'>): string { return `${displayBody(window.mover)} ${displayAspect(window.aspectType)} ${displayTarget(window.target)}`; }
export function importanceLabel(window: Pick<ActiveWindow, 'importanceBand' | 'importanceScore'>): CustomerImportance { return BAND_NAMES[window.importanceBand] || (window.importanceScore >= 80 ? 'Very High' : window.importanceScore >= 65 ? 'High' : window.importanceScore >= 50 ? 'Moderate' : 'Supporting'); }

function titleWords(value: string): string { return value.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/[^A-Za-z0-9]+/).filter(Boolean).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' '); }
function monthKey(utc: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit' }).formatToParts(new Date(utc));
  return `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}`;
}
function monthLabel(key: string, timezone: string): string {
  const [year, month] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { timeZone: timezone, month: 'long', year: 'numeric' }).format(new Date(Date.UTC(year, month - 1, 15)));
}
function dateLabel(utc: string, timezone: string, withDay = false): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: timezone, month: 'short', ...(withDay ? { day: 'numeric' } : {}), year: 'numeric' }).format(new Date(utc));
}
function rangeLabel(start: string, end: string, timezone: string): string {
  const a = dateLabel(start, timezone); const b = dateLabel(end, timezone);
  return a === b ? a : `${a} - ${b}`;
}
function hitLabel(utc: string, timezone: string): string { return dateLabel(utc, timezone, true); }
function phasePeriodLabel(phase: PresentationPhase, timezone: string): string { return `${phase.label}: ${rangeLabel(phase.startUtc, phase.endUtc, timezone)}`; }
function compareUtc(a: string, b: string): number { return Date.parse(a) - Date.parse(b); }
function uniqueSorted(values: string[]): string[] { return [...new Set(values)].sort(compareUtc); }
function lifeArea(target: string, house: number | null): string {
  if (target === 'asc' || house === 1) return 'Identity & personal direction';
  if (target === 'mc' || house === 10) return 'Career & public path';
  if (house === 2) return 'Resources & self-worth';
  if (house === 6) return 'Work, health & daily rhythm';
  if (house === 7) return 'Partnerships & agreements';
  if (house === 4) return 'Home, family & foundations';
  if (house === 9) return 'Beliefs, study & horizons';
  return 'Inner development & life direction';
}
function phaseLabel(direction: string, retrograde: boolean): CustomerPhase {
  if (direction === 'applying') return 'Applying';
  if (direction === 'separating') return 'Separating / integration';
  if (retrograde) return 'Retrograde return';
  return 'Active';
}
function mergePhases(segments: Array<{ segment: ActiveWindow['segments'][number]; retrograde: boolean }>, hits: PresentationExactHit[]): PresentationPhase[] {
  const phases: PresentationPhase[] = [];
  for (const entry of [...segments].sort((a, b) => compareUtc(a.segment.startUtc, b.segment.startUtc))) {
    const segment = entry.segment;
    const label = phaseLabel(segment.direction, entry.retrograde);
    const previous = phases[phases.length - 1];
    if (previous && previous.label === label && previous.endUtc >= segment.startUtc) {
      previous.endUtc = previous.endUtc > segment.endUtc ? previous.endUtc : segment.endUtc;
      previous.directions = [...new Set([...previous.directions, segment.direction])];
      previous.retrograde ||= entry.retrograde;
    } else {
      phases.push({ label, startUtc: segment.startUtc, endUtc: segment.endUtc, exactHits: [], directions: [segment.direction], retrograde: entry.retrograde });
    }
  }
  for (const hit of hits) {
    const phase = phases.find((item) => Date.parse(hit.utc) >= Date.parse(item.startUtc) && Date.parse(hit.utc) <= Date.parse(item.endUtc));
    if (phase) {
      phase.exactHits.push(hit.utc);
      if (hit.retrograde) { phase.label = 'Retrograde return'; phase.retrograde = true; }
    }
  }
  return phases;
}

export function groupTransitWindows(pack: YearlyTransitFactPack): GroupedTransitPresentation[] {
  const groups = new Map<string, ActiveWindow[]>();
  for (const window of pack.windows) {
    const key = `${window.mover}|${window.target}|${window.aspectType}`;
    groups.set(key, [...(groups.get(key) || []), window]);
  }
  return [...groups.entries()].map(([key, windows]) => {
    const ordered = [...windows].sort((a, b) => compareUtc(a.activeWindow.startUtc, b.activeWindow.startUtc));
    const first = ordered[0];
    const exactHits = uniqueSorted(ordered.flatMap((window) => window.exactHits.map((hit) => hit.exactUtc))).map((utc) => {
      const hit = ordered.flatMap((window) => window.exactHits).find((item) => item.exactUtc === utc)!;
      return { utc, direction: hit.direction, retrograde: hit.retrograde };
    });
    const phases = mergePhases(ordered.flatMap((window) => window.segments.map((segment) => ({ segment, retrograde: window.retrograde }))), exactHits);
    return {
      id: `transit.${key.split('|').join('.')}`,
      mover: first.mover,
      target: first.target,
      aspect: first.aspectType,
      heading: displayTransit(first),
      activeStartUtc: ordered.reduce((value, window) => compareUtc(window.activeWindow.startUtc, value) < 0 ? window.activeWindow.startUtc : value, first.activeWindow.startUtc),
      activeEndUtc: ordered.reduce((value, window) => compareUtc(window.activeWindow.endUtc, value) > 0 ? window.activeWindow.endUtc : value, first.activeWindow.endUtc),
      importance: importanceLabel(ordered.reduce((best, window) => window.importanceScore > best.importanceScore ? window : best, first)),
      importanceScore: Math.max(...ordered.map((window) => window.importanceScore)),
      lifeArea: lifeArea(first.target, first.house),
      house: first.house,
      exactHits,
      phases,
      evidenceIds: [...new Set(ordered.flatMap((window) => window.evidenceIds))],
      passCount: ordered.length,
      retrograde: ordered.some((window) => window.retrograde || window.segments.some((segment) => segment.direction === 'stationary')),
    };
  }).sort((a, b) => b.importanceScore - a.importanceScore || compareUtc(a.activeStartUtc, b.activeStartUtc) || a.id.localeCompare(b.id));
}

const INTERNAL_TEXT = /importanceScore|rawImportanceScore|\bYt Window\b|(?:^|[^A-Za-z])(?:mover|aspectType|activeWindow|evidenceIds|schemaVersion)(?:$|[^A-Za-z])/i;
const ISO_TEXT = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/;

export function buildYearlyTransitPresentation(pack: YearlyTransitFactPack): YearlyTransitPresentation {
  const groupedTransits = groupTransitWindows(pack);
  const start = Date.parse(pack.period.fromUtc);
  const monthly: MonthlyPresentation[] = [];
  const cursor = new Date(start);
  for (let index = 0; index < 12; index += 1) {
    const key = monthKey(cursor.toISOString(), pack.displayTimezone);
    const transitIds = groupedTransits.filter((transit) => {
      const first = Date.parse(transit.activeStartUtc); const last = Date.parse(transit.activeEndUtc); const monthStart = Date.parse(new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1)).toISOString()); const monthEnd = Date.parse(new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1)).toISOString());
      return first < monthEnd && last >= monthStart;
    }).map((transit) => transit.id);
    monthly.push({ key, label: monthLabel(key, pack.displayTimezone), transitIds, summary: transitIds.length ? 'Active transit themes' : 'Integration and consolidation' });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  const primaryIds = new Set(pack.aiPacks.primaryWindows.map((item) => item.id));
  const appendix = pack.windows.filter((window) => !primaryIds.has(window.id) && window.importanceScore >= 40).map((window) => ({ id: window.id, transit: displayTransit(window), startUtc: window.activeWindow.startUtc, endUtc: window.activeWindow.endUtc, importance: importanceLabel(window), meaning: `${displayBody(window.mover)} brings a ${displayAspect(window.aspectType).toLowerCase()} perspective to ${displayTarget(window.target)}.`, evidenceIds: [...window.evidenceIds] }));
  const presentation = { periodStartUtc: pack.period.fromUtc, periodEndUtc: pack.period.toUtc, timezone: pack.displayTimezone, groupedTransits, monthly, appendix };
  validateYearlyTransitPresentation(presentation);
  return presentation;
}

export function validateYearlyTransitPresentation(presentation: YearlyTransitPresentation): void {
  if (!presentation || presentation.monthly.length !== 12) throw new Error('yearly-transit presentation requires twelve months');
  if (new Set(presentation.groupedTransits.map((item) => item.heading)).size !== presentation.groupedTransits.length) throw new Error('duplicate customer transit heading');
  for (const month of presentation.monthly) if (!/^[A-Z][a-z]+ \d{4}$/.test(month.label) || /^Month /.test(month.label)) throw new Error('invalid customer month label');
  for (const transit of presentation.groupedTransits) {
    if (INTERNAL_TEXT.test(transit.heading) || ISO_TEXT.test(transit.heading)) throw new Error('internal transit text leaked');
    if (Date.parse(transit.activeStartUtc) > Date.parse(transit.activeEndUtc)) throw new Error('transit active window is inverted');
    for (const hit of transit.exactHits) if (Date.parse(hit.utc) < Date.parse(transit.activeStartUtc) || Date.parse(hit.utc) > Date.parse(transit.activeEndUtc)) throw new Error('exact hit outside active window');
    for (const phase of transit.phases) if (Date.parse(phase.startUtc) > Date.parse(phase.endUtc) || Date.parse(phase.startUtc) < Date.parse(transit.activeStartUtc) || Date.parse(phase.endUtc) > Date.parse(transit.activeEndUtc)) throw new Error('phase outside active window');
  }
}

export function toCustomerYearlyTransitPresentation(presentation: YearlyTransitPresentation): CustomerYearlyTransitPresentation {
  return {
    periodLabel: rangeLabel(presentation.periodStartUtc, presentation.periodEndUtc, presentation.timezone),
    groupedTransits: presentation.groupedTransits.map((transit) => ({
      id: transit.id,
      heading: transit.heading,
      activePeriod: rangeLabel(transit.activeStartUtc, transit.activeEndUtc, presentation.timezone),
      importance: transit.importance,
      lifeArea: transit.lifeArea,
      exactHits: transit.exactHits.map((hit) => `${hitLabel(hit.utc, presentation.timezone)}${hit.retrograde ? ' (retrograde)' : ''}`),
      phases: transit.phases.map((phase) => ({ label: phase.label, period: phasePeriodLabel(phase, presentation.timezone) })),
      passCount: transit.passCount,
    })),
    monthly: presentation.monthly.map((month) => ({ key: month.key, label: month.label, transitNames: month.transitIds.map((id) => presentation.groupedTransits.find((transit) => transit.id === id)?.heading).filter((name): name is string => Boolean(name)), summary: month.summary })),
    appendix: presentation.appendix.map((item) => ({ id: item.id, transit: item.transit, activePeriod: rangeLabel(item.startUtc, item.endUtc, presentation.timezone), importance: item.importance, meaning: item.meaning })),
  };
}
