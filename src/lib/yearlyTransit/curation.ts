import type { ActiveWindow, YearlyTransitFactPack } from './types';
import { displayTransit, groupTransitWindows, importanceLabel, type GroupedTransitPresentation } from './presentation';

export const MAX_MONTHLY_PRIMARY = 4;
export const MAX_MONTHLY_SECONDARY = 3;
export const MAX_SUPPORTING_INFLUENCES = 12;

export interface CustomerDate {
  utc: string;
  label: string;
}

export interface CuratedInfluence {
  id: string;
  heading: string;
  importance: ReturnType<typeof importanceLabel>;
  importanceScore: number;
  activePeriod: string;
  exactHits: CustomerDate[];
  evidenceIds: string[];
  mover: string;
  target: string;
  aspect: string;
  lifeArea: string;
  isMajor: boolean;
  timingSignals: string[];
}

export interface CuratedMonth {
  key: string;
  displayName: string;
  primaryInfluences: CuratedInfluence[];
  secondaryInfluences: CuratedInfluence[];
  keyDates: CustomerDate[];
  evidenceIds: string[];
}

export interface CuratedSupportingInfluence extends CuratedInfluence { meaning: string }

function fmt(utc: string, timezone: string, withDay = false): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    month: 'short',
    ...(withDay ? { day: 'numeric' } : {}),
    year: 'numeric',
  }).format(new Date(utc));
}

export function customerDate(utc: string, timezone: string): CustomerDate { return { utc, label: fmt(utc, timezone, true) }; }
export function customerPeriod(startUtc: string, endUtc: string, timezone: string): string {
  const start = fmt(startUtc, timezone); const end = fmt(endUtc, timezone);
  return start === end ? start : `${start} - ${end}`;
}
export function customerMonth(key: string, timezone: string): string {
  const [year, month] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { timeZone: timezone, month: 'long', year: 'numeric' }).format(new Date(Date.UTC(year, month - 1, 15)));
}


function localMonth(utc: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit' }).formatToParts(new Date(utc));
  return `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}`;
}
function addMonths(key: string, offset: number): string {
  const [year, month] = key.split('-').map(Number); const date = new Date(Date.UTC(year, month - 1 + offset, 15));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}
function keysTouched(startUtc: string, endUtc: string, timezone: string): Set<string> {
  const keys = new Set<string>();
  for (let cursor = Date.parse(startUtc); cursor <= Date.parse(endUtc); cursor += 24 * 60 * 60 * 1000) keys.add(localMonth(new Date(cursor).toISOString(), timezone));
  keys.add(localMonth(endUtc, timezone)); return keys;
}
function majorIds(pack: YearlyTransitFactPack): Set<string> {
  const raw = new Set(pack.aiPacks.primaryWindows.map((item) => item.id));
  return new Set(groupTransitWindows(pack).filter((group) => pack.windows.some((window) => raw.has(window.id) && group.id === stableGroupId(window))).map((group) => group.id));
}
function stableGroupId(window: Pick<ActiveWindow, 'mover' | 'target' | 'aspectType'>): string { return `transit.${window.mover}.${window.target}.${window.aspectType}`; }
function rank(group: GroupedTransitPresentation, monthKey: string, timezone: string, isMajor: boolean): number {
  const hit = group.exactHits.some((item) => localMonth(item.utc, timezone) === monthKey);
  const starts = localMonth(group.activeStartUtc, timezone) === monthKey;
  const ends = localMonth(group.activeEndUtc, timezone) === monthKey;
  const angular = group.target === 'asc' || group.target === 'mc';
  const slow = ['jupiter', 'saturn', 'uranus', 'neptune', 'pluto'].includes(group.mover);
  const moonNoise = group.mover === 'moon' && group.importanceScore < 80;
  return group.importanceScore + (isMajor ? 28 : 0) + (hit ? 24 : 0) + (starts || ends ? 12 : 0) + (angular ? 10 : 0) + (slow ? 8 : 0) - (moonNoise ? 80 : 0) + (keysTouched(group.activeStartUtc, group.activeEndUtc, timezone).has(monthKey) ? 0 : -999);
}
function influence(group: GroupedTransitPresentation, timezone: string, isMajor: boolean): CuratedInfluence {
  const timingSignals = [
    ...(group.exactHits.length ? [`Exact: ${group.exactHits.map((hit) => customerDate(hit.utc, timezone).label).join(', ')}`] : []),
    ...(group.retrograde ? ['Includes a retrograde return'] : []),
  ];
  return { id: group.id, heading: group.heading, importance: group.importance, importanceScore: group.importanceScore, activePeriod: customerPeriod(group.activeStartUtc, group.activeEndUtc, timezone), exactHits: group.exactHits.map((hit) => customerDate(hit.utc, timezone)), evidenceIds: group.evidenceIds, mover: group.mover, target: group.target, aspect: group.aspect, lifeArea: group.lifeArea, isMajor, timingSignals };
}

export function curatedMonths(pack: YearlyTransitFactPack): CuratedMonth[] {
  const groups = groupTransitWindows(pack); const major = majorIds(pack); const output: CuratedMonth[] = [];
  const firstKey = localMonth(pack.period.fromUtc, pack.displayTimezone);
  for (let index = 0; index < 12; index += 1) {
    const key = addMonths(firstKey, index);
    const candidates = groups
      .filter((group) => group.mover !== 'moon' || group.importanceScore >= 80)
      .map((group) => ({ group, major: major.has(group.id), score: rank(group, key, pack.displayTimezone, major.has(group.id)) }))
      .filter((item) => item.score > -900)
      .sort((a, b) => b.score - a.score || a.group.id.localeCompare(b.group.id));
    const primary = candidates.slice(0, MAX_MONTHLY_PRIMARY).map((item) => influence(item.group, pack.displayTimezone, item.major));
    const secondary = candidates.slice(MAX_MONTHLY_PRIMARY, MAX_MONTHLY_PRIMARY + MAX_MONTHLY_SECONDARY).map((item) => influence(item.group, pack.displayTimezone, item.major));
    const keyDates = [...new Map(primary
      .flatMap((item) => item.exactHits.filter((hit) => localMonth(hit.utc, pack.displayTimezone) === key))
      .sort((a, b) => a.utc.localeCompare(b.utc))
      .map((date) => [date.label, date] as const)).values()];
    output.push({ key, displayName: customerMonth(key, pack.displayTimezone), primaryInfluences: primary, secondaryInfluences: secondary, keyDates, evidenceIds: [...new Set([...primary, ...secondary].flatMap((item) => item.evidenceIds))] });
  }
  return output;
}

function supportingMeaning(item: CuratedInfluence): string {
  const area = item.lifeArea.toLowerCase();
  const mover = item.mover[0].toUpperCase() + item.mover.slice(1);
  const aspect = item.aspect === 'trine' || item.aspect === 'sextile' ? 'supports' : item.aspect === 'square' || item.aspect === 'opposition' ? 'asks for adjustment in' : 'intensifies';
  return `${mover} ${aspect} ${area}, inviting a practical response rather than a fixed outcome.`;
}

export function curatedMajorInfluences(pack: YearlyTransitFactPack): CuratedInfluence[] {
  const major = majorIds(pack);
  return groupTransitWindows(pack)
    .filter((group) => major.has(group.id))
    .sort((a, b) => b.importanceScore - a.importanceScore || a.id.localeCompare(b.id))
    .slice(0, 8)
    .map((group) => influence(group, pack.displayTimezone, true));
}

export function curatedSignificantInfluences(pack: YearlyTransitFactPack): CuratedInfluence[] {
  const major = majorIds(pack);
  return groupTransitWindows(pack)
    .filter((group) => !major.has(group.id) && group.importanceScore >= 50)
    .sort((a, b) => b.importanceScore - a.importanceScore || a.id.localeCompare(b.id))
    .slice(0, 6)
    .map((group) => influence(group, pack.displayTimezone, false));
}

export function curatedSupportingInfluences(pack: YearlyTransitFactPack): CuratedSupportingInfluence[] {
  const major = majorIds(pack);
  return groupTransitWindows(pack)
    .filter((group) => !major.has(group.id) && group.importanceScore >= 40 && group.importanceScore < 50)
    .sort((a, b) => b.importanceScore - a.importanceScore || a.id.localeCompare(b.id))
    .slice(0, MAX_SUPPORTING_INFLUENCES)
    .map((group) => {
      const item = influence(group, pack.displayTimezone, false);
      return { ...item, meaning: supportingMeaning(item) };
    });
}

/** The only timing labels supplied to the Yearly AI writer. */
export function buildYearlyTransitAiBrief(pack: YearlyTransitFactPack) {
  const major = majorIds(pack);
  const groups = groupTransitWindows(pack)
    .filter((group) => major.has(group.id))
    .slice(0, 8)
    .map((group) => influence(group, pack.displayTimezone, true));
  return {
    contractVersion: 'csg-yearly-transit-presentation-v2',
    forecastPeriod: customerPeriod(pack.period.fromUtc, pack.period.toUtc, pack.displayTimezone),
    primaryWindows: groups.map((group) => ({ ...group, id: `primary.${group.id}` })),
    significantWindows: curatedSignificantInfluences(pack).map((group) => ({ ...group, id: `significant.${group.id}` })),
    monthlyContext: curatedMonths(pack).map((month) => ({
      id: `month.${month.key}`,
      monthKey: month.key,
      displayName: month.displayName,
      primaryInfluences: month.primaryInfluences,
      secondaryInfluences: month.secondaryInfluences,
      keyDates: month.keyDates,
      evidenceIds: month.evidenceIds,
    })),
    actions: groups.slice(0, 12).map((group, index) => ({ id: `action.${index + 1}.${group.id}`, transit: group.heading, activePeriod: group.activePeriod, exactHits: group.exactHits, lifeArea: group.lifeArea, evidenceIds: group.evidenceIds })),
    supportingInfluences: curatedSupportingInfluences(pack),
  };
}
