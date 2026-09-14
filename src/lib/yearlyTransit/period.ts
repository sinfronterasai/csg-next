import { YEARLY_TRANSIT_REPORT_TYPE } from './types';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidIsoDate(value: string): boolean {
  const m = ISO_DATE.exec(value);
  if (!m) return false;
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return date.getUTCFullYear() === Number(m[1]) &&
    date.getUTCMonth() === Number(m[2]) - 1 && date.getUTCDate() === Number(m[3]);
}

function localMidnightParts(date: string, timezone: string): Date {
  if (!isValidIsoDate(date)) throw new Error(`invalid fromDate: ${date}`);
  try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }); }
  catch { throw new Error(`invalid display timezone: ${timezone}`); }

  // Validate local midnight by round-tripping the resolved instant. This rejects
  // nonexistent/ambiguous midnight rather than silently selecting a server zone.
  const [year, month, day] = date.split('-').map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, calendar: 'gregory', numberingSystem: 'latn',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(probe);
  const values: Record<string, number> = {};
  for (const part of parts) if (part.type !== 'literal') values[part.type] = Number(part.value);
  const offsetMs = Date.UTC(values.year, values.month - 1, values.day, values.hour % 24, values.minute, values.second) - probe.getTime();
  const utc = new Date(probe.getTime() - offsetMs);
  const roundTrip = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(utc);
  if (roundTrip !== date) throw new Error(`local midnight is not representable: ${date} ${timezone}`);
  return utc;
}

export function buildRollingUtcPeriod(fromDate: string, displayTimezone: string): { fromUtc: string; toUtc: string; displayTimezone: string; reportType: typeof YEARLY_TRANSIT_REPORT_TYPE } {
  const from = localMidnightParts(fromDate, displayTimezone);
  const [year, month, day] = fromDate.split('-').map(Number);
  const toLocal = `${String(year + 1).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const to = localMidnightParts(toLocal, displayTimezone);
  return { fromUtc: from.toISOString(), toUtc: to.toISOString(), displayTimezone, reportType: YEARLY_TRANSIT_REPORT_TYPE };
}

export function isInInclusivePeriod(instantUtc: string, period: { fromUtc: string; toUtc: string }): boolean {
  const instant = Date.parse(instantUtc);
  const from = Date.parse(period.fromUtc);
  const to = Date.parse(period.toUtc);
  return Number.isFinite(instant) && Number.isFinite(from) && Number.isFinite(to) && from <= instant && instant <= to;
}
