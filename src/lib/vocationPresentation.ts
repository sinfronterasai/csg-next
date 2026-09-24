export interface VocationWindowLike {
  id: string; localStart: string; localEnd: string; mover: string; target: string; aspect: string; direction: string; score?: number;
  activeWindow?: { startUtc: string; endUtc: string };
  exactHits?: Array<{ exactUtc: string }>;
}

export interface VocationPeriod {
  name: string; start: string; end: string; windows: VocationWindowLike[]; meaning: string; action: string; caution: string;
}

const ASPECT_LABEL: Record<string, string> = { conjunction: 'conjunction', sextile: 'sextile', square: 'square', trine: 'trine', opposition: 'opposition' };
const TARGET_LABEL: Record<string, string> = { mc: 'your public direction (Midheaven)', mercury: 'communication and resource skills', venus: 'value, money, and relationship dynamics', mars: 'initiative and execution', jupiter: 'growth and opportunity', saturn: 'structure, responsibility, and durability' };
const DIRECTION_LABEL: Record<string, string> = { applying: 'building toward its clearest expression', separating: 'integrating what has already become visible', stationary: 'asking for patience and careful observation', indeterminate: 'best handled with flexibility' };

export function humanPlanet(value: string): string { return value.charAt(0).toUpperCase() + value.slice(1); }
export function humanTarget(value: string): string { return TARGET_LABEL[value] ?? humanPlanet(value); }
export function humanAspect(value: string): string { return ASPECT_LABEL[value] ?? value; }
export function explainDirection(value: string): string { return DIRECTION_LABEL[value] ?? 'best handled with flexibility'; }

function daysBetween(a: string, b: string): number { return Math.abs(Date.parse(a) - Date.parse(b)) / 86400000; }

export function customerEndDate(pack: { period: { toUtc: string }; displayTimezone: string }): string {
  const last = new Date(Date.parse(pack.period.toUtc) - 1);
  return new Intl.DateTimeFormat('en-US', { timeZone: pack.displayTimezone, year: 'numeric', month: 'long', day: 'numeric' }).format(last);
}

export function customerCoverageLabel(pack: { generatedLocalDate: string; period: { toUtc: string }; displayTimezone: string; months: unknown[] }): string {
  const start = new Intl.DateTimeFormat('en-US', { timeZone: pack.displayTimezone, year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(`${pack.generatedLocalDate}T12:00:00Z`));
  return `${start} through ${customerEndDate(pack)} (${pack.months.length} calendar months; ${pack.displayTimezone})`;
}

export function buildVocationPeriods(windows: VocationWindowLike[]): VocationPeriod[] {
  const sorted = [...windows].sort((a, b) => a.localStart.localeCompare(b.localStart) || a.localEnd.localeCompare(b.localEnd));
  const groups: VocationWindowLike[][] = [];
  for (const window of sorted) {
    const previous = groups.at(-1);
    const previousEnd = previous?.reduce((max, item) => item.localEnd > max ? item.localEnd : max, '') ?? '';
    if (!previous || daysBetween(window.localStart, previousEnd) > 45) groups.push([window]); else previous.push(window);
  }
  return groups.slice(0, 6).map((group, index) => {
    const start = group[0].localStart;
    const end = group.reduce((max, item) => item.localEnd > max ? item.localEnd : max, group[0].localEnd);
    const challenging = group.some((w) => ['square', 'opposition'].includes(w.aspect));
    const targets = [...new Set(group.map((w) => humanTarget(w.target)))].slice(0, 2).join(' and ');
    const movers = [...new Set(group.map((w) => humanPlanet(w.mover)))].join(' and ');
    return {
      name: `${challenging ? 'Pressure and choice' : 'Build and expand'} ${index + 1}`,
      start, end, windows: group,
      meaning: `${movers} activity concentrates on ${targets}. ${challenging ? 'This is a development period: friction can reveal where an ambitious plan needs clearer limits, better timing, or stronger evidence.' : 'This is a constructive period for turning an existing strength into a visible, repeatable practice.'}`,
      action: challenging ? 'Choose one priority, define the constraint that protects it, and test the next step before committing more resources.' : 'Put one well-defined idea into motion, document the result, and build on what proves useful.',
      caution: challenging ? 'Do not treat intensity as proof that a launch is timely; leave room to revise.' : 'Momentum is not a guarantee of an outcome; keep promises, costs, and capacity realistic.',
    };
  });
}

export function buildVocationAppendix(windows: VocationWindowLike[]): Array<{ start: string; end: string; transit: string; direction: string; exact: string }> {
  return [...windows].sort((a, b) => a.localStart.localeCompare(b.localStart) || a.localEnd.localeCompare(b.localEnd)).map((w) => ({
    start: w.localStart, end: w.localEnd,
    transit: `${humanPlanet(w.mover)} ${humanAspect(w.aspect)} ${humanTarget(w.target)}`,
    direction: explainDirection(w.direction),
    exact: (w.exactHits ?? []).map((hit) => hit.exactUtc).join(', '),
  }));
}
