import type { UniversalReadingRecord } from './store';

// Patterns insight layer. Computed on-read from the user's OWN readings.
// Frames everything as reflection ("you may notice"), never prediction.
// Pure functions: no DB, no side effects — easy to unit test.

export const MIN_READINGS_FOR_PATTERNS = 3;

export interface RecurringCard {
  card: string;
  count: number;
  reversedCount: number;
  firstSeen: string;
  lastSeen: string;
  categories: string[];
}

export interface RecurringTheme {
  theme: string;
  count: number;
}

export interface SignResonance {
  sign: string;
  appearances: number;
}

export interface TimingCluster {
  id: string;
  window: string;
  detail: string;
  count: number;
}

export interface ReportMotif {
  motif: string;
  count: number;
}

// 12-month hardcoded transit markers (no live ephemeris needed for MVP).
// Each marker is a label + inclusive date window (ISO yyyy-mm-dd).
export interface TransitMarker {
  label: string;
  window: string;
  start: string;
  end: string;
}

export const TRANSIT_MARKERS: TransitMarker[] = [
  { label: 'Mercury Retrograde', window: 'late Jan–early Feb', start: '2026-01-26', end: '2026-02-18' },
  { label: 'Mercury Retrograde', window: 'mid May–early Jun', start: '2026-05-18', end: '2026-06-11' },
  { label: 'Mercury Retrograde', window: 'late Aug–mid Sep', start: '2026-08-24', end: '2026-09-15' },
  { label: 'Mercury Retrograde', window: 'early Dec', start: '2026-12-07', end: '2026-12-27' },
  { label: 'Spring Equinox', window: 'Mar 20', start: '2026-03-20', end: '2026-03-20' },
  { label: 'Summer Solstice', window: 'Jun 21', start: '2026-06-21', end: '2026-06-21' },
  { label: 'Autumn Equinox', window: 'Sep 22', start: '2026-09-22', end: '2026-09-22' },
  { label: 'Winter Solstice', window: 'Dec 21', start: '2026-12-21', end: '2026-12-21' },
  { label: 'Full Moon (Harvest)', window: 'Oct 4', start: '2026-10-04', end: '2026-10-04' },
  { label: 'Lunar Eclipse', window: 'Mar 3', start: '2026-03-03', end: '2026-03-03' },
  { label: 'Solar Eclipse', window: 'Aug 12', start: '2026-08-12', end: '2026-08-12' },
  { label: 'Venus Retrograde', window: 'late Feb–early Mar', start: '2026-02-28', end: '2026-03-22' },
];

const ELEMENTS: Record<string, string> = {
  Aries: 'Fire', Leo: 'Fire', Sagittarius: 'Fire',
  Taurus: 'Earth', Virgo: 'Earth', Capricorn: 'Earth',
  Gemini: 'Air', Libra: 'Air', Aquarius: 'Air',
  Cancer: 'Water', Scorpio: 'Water', Pisces: 'Water',
};

const REFLECTION_PROMPTS: Record<string, string> = {
  'The Tower': 'When The Tower appears, what in your life is ending so something truer can begin?',
  'Death': 'When Death appears, where are you being asked to release what no longer serves?',
  'The Star': 'When The Star appears, what hope are you being invited to trust?',
  'The Moon': 'When The Moon appears, which quiet intuition have you been ignoring?',
  'The Sun': 'When The Sun appears, what is finally coming into the light?',
  'The Lovers': 'When The Lovers appears, which choice is asking for your whole truth?',
  'Three of Swords': 'When the Three of Swords appears, what grief is ready to be felt and released?',
  'Ten of Cups': 'When the Ten of Cups appears, what fullness are you already holding?',
};

// Serializable form of the prompts (functions are dropped by JSON.stringify).
export const REFLECTION_PROMPTS_MAP: Record<string, string> = REFLECTION_PROMPTS;

function inWindow(dateIso: string, start: string, end: string): boolean {
  if (!dateIso) return false;
  const d = dateIso.slice(0, 10);
  return d >= start && d <= end;
}

function cardNamesFrom(reading: UniversalReadingRecord): { name: string; reversed: boolean }[] {
  const cards = (reading.result?.cards as any[]) || [];
  return cards.map((c) => ({
    name: typeof c === 'string' ? c : c.name,
    reversed: typeof c === 'string' ? false : !!c.reversed,
  }));
}

export function computeRecurringCards(readings: UniversalReadingRecord[]): RecurringCard[] {
  const tarot = readings.filter((r) => r.type === 'tarot');
  const byCard = new Map<string, RecurringCard>();
  for (const r of tarot) {
    const cats = r.category ? [r.category] : [];
    for (const { name, reversed } of cardNamesFrom(r)) {
      if (!name) continue;
      const existing = byCard.get(name);
      if (!existing) {
        byCard.set(name, {
          card: name,
          count: 1,
          reversedCount: reversed ? 1 : 0,
          firstSeen: r.createdAt,
          lastSeen: r.createdAt,
          categories: cats,
        });
      } else {
        existing.count += 1;
        if (reversed) existing.reversedCount += 1;
        if (r.createdAt < existing.firstSeen) existing.firstSeen = r.createdAt;
        if (r.createdAt > existing.lastSeen) existing.lastSeen = r.createdAt;
        for (const c of cats) if (!existing.categories.includes(c)) existing.categories.push(c);
      }
    }
  }
  return Array.from(byCard.values())
    .filter((c) => c.count >= 2)
    .sort((a, b) => b.count - a.count || a.card.localeCompare(b.card));
}

export function computeRecurringThemes(readings: UniversalReadingRecord[]): RecurringTheme[] {
  const counts = new Map<string, number>();
  for (const r of readings) {
    if (r.category) counts.set(r.category, (counts.get(r.category) || 0) + 1);
    const title = r.title || '';
    if (r.type === 'report' && title) counts.set(`report: ${title}`, (counts.get(`report: ${title}`) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([theme, count]) => ({ theme, count }))
    .sort((a, b) => b.count - a.count);
}

export function computeSignResonance(readings: UniversalReadingRecord[], horoscopeSign?: string | null): SignResonance[] {
  const counts = new Map<string, number>();
  const add = (sign: string) => { if (sign) counts.set(sign, (counts.get(sign) || 0) + 1); };
  if (horoscopeSign) add(horoscopeSign);
  for (const r of readings) {
    if (r.type === 'horoscope') {
      const sign = r.question || r.title || '';
      const matched = (sign.match(/(Aries|Taurus|Gemini|Cancer|Leo|Virgo|Libra|Scorpio|Sagittarius|Capricorn|Aquarius|Pisces)/) || [])[0];
      if (matched) add(matched);
    }
  }
  return Array.from(counts.entries())
    .map(([sign, appearances]) => ({ sign, appearances }))
    .sort((a, b) => b.appearances - a.appearances);
}

export function computeElementBalance(readings: UniversalReadingRecord[], horoscopeSign?: string | null): Record<string, number> {
  const balance: Record<string, number> = { Fire: 0, Earth: 0, Air: 0, Water: 0 };
  const signs = computeSignResonance(readings, horoscopeSign).map((s) => s.sign);
  for (const sign of signs) {
    const el = ELEMENTS[sign];
    if (el) balance[el] += 1;
  }
  return balance;
}

export function computeTimingClusters(readings: UniversalReadingRecord[]): TimingCluster[] {
  const clusters = new Map<string, TimingCluster>();
  for (const r of readings) {
    for (const m of TRANSIT_MARKERS) {
      if (inWindow(r.createdAt, m.start, m.end)) {
        const key = `${m.label} ${m.start}`;
        const existing = clusters.get(key);
        if (existing) existing.count += 1;
        else clusters.set(key, { id: key, window: m.window, detail: m.label, count: 1 });
      }
    }
  }
  return Array.from(clusters.values()).sort((a, b) => b.count - a.count);
}

const REPORT_MOTIF_WORDS = [
  'boundary', 'visibility', 'rest', 'release', 'trust', 'alignment',
  'patience', 'voice', 'root', 'threshold', 'invitation', 'worth',
];

export function computeReportMotifs(readings: UniversalReadingRecord[]): ReportMotif[] {
  const text = readings
    .filter((r) => r.type === 'report')
    .map((r) => (r.result?.text as string) || '')
    .join(' ')
    .toLowerCase();
  const found: ReportMotif[] = [];
  for (const motif of REPORT_MOTIF_WORDS) {
    // Whole-word match so 'interest' cannot fabricate a 'rest' insight.
    const re = new RegExp(`\\b${motif}\\b`, 'g');
    const count = (text.match(re) || []).length;
    if (count > 0) found.push({ motif, count });
  }
  return found.sort((a, b) => b.count - a.count);
}

export interface PatternsResult {
  eligible: boolean;
  totalReadings: number;
  recurringCards: RecurringCard[];
  recurringThemes: RecurringTheme[];
  signResonance: SignResonance[];
  elementBalance: Record<string, number>;
  timingClusters: TimingCluster[];
  reportMotifs: ReportMotif[];
  reflectionPrompts: Record<string, string>;
  optedOut: boolean;
}

export function computePatterns(
  readings: UniversalReadingRecord[],
  opts: { horoscopeSign?: string | null; patternsOptIn?: boolean } = {},
): PatternsResult {
  const optedIn = opts.patternsOptIn ?? true;
  const eligible = optedIn && readings.length >= MIN_READINGS_FOR_PATTERNS;

  if (!optedIn) {
    // Enforce opt-out before computing or returning any aggregates (#214).
    return {
      eligible: false,
      totalReadings: 0,
      recurringCards: [],
      recurringThemes: [],
      signResonance: [],
      elementBalance: { Fire: 0, Earth: 0, Air: 0, Water: 0 },
      timingClusters: [],
      reportMotifs: [],
      reflectionPrompts: {},
      optedOut: true,
    };
  }

  return {
    recurringCards: computeRecurringCards(readings),
    recurringThemes: computeRecurringThemes(readings),
    signResonance: computeSignResonance(readings, opts.horoscopeSign),
    elementBalance: computeElementBalance(readings, opts.horoscopeSign),
    timingClusters: computeTimingClusters(readings),
    reportMotifs: computeReportMotifs(readings),
    eligible,
    totalReadings: readings.length,
    reflectionPrompts: REFLECTION_PROMPTS,
    optedOut: false,
  };
}
