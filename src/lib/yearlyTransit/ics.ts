import crypto from 'crypto';
import type { ActiveWindow, YearlyTransitFactPack } from './types';

function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}
function utcValue(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) throw new Error(`invalid ICS timestamp: ${iso}`);
  const d = new Date(Math.floor(ms / 1000) * 1000);
  return d.toISOString().replace(/[-:]/g, '').replace('.000Z', 'Z');
}
function uid(reportId: string, transitId: string, eventType: string, exactUtc: string): string {
  const digest = crypto.createHash('sha256').update(Buffer.from(`${reportId}\0${transitId}\0${eventType}\0${utcValue(exactUtc)}`, 'utf8')).digest('hex');
  return `${digest}@cosmicspiritguide.com`;
}
function fold(line: string): string[] {
  const bytes = Buffer.from(line, 'utf8'); const out: string[] = [];
  let start = 0; let first = true;
  while (start < bytes.length) {
    const limit = first ? 75 : 74; let end = Math.min(start + limit, bytes.length);
    while (end > start && (bytes[end] & 0xc0) === 0x80) end--;
    out.push((first ? '' : ' ') + bytes.subarray(start, end).toString('utf8'));
    start = end; first = false;
  }
  return out.length ? out : [''];
}
function line(name: string, value: string): string[] { return fold(`${name}:${value}`); }
function eventLines(pack: YearlyTransitFactPack, reportId: string, window: ActiveWindow, eventType: string, instant: string, summary: string, description: string): string[] {
  const start = utcValue(instant); const end = utcValue(new Date(Date.parse(instant) + 60_000).toISOString());
  return ['BEGIN:VEVENT', ...line('UID', uid(reportId, window.canonicalTransitId, eventType, instant)), ...line('DTSTAMP', utcValue(pack.snapshot.generatedAtUtc)), ...line('DTSTART', start), ...line('DTEND', end), ...line('SUMMARY', escapeText(summary)), ...line('DESCRIPTION', escapeText(description)), 'END:VEVENT'];
}

export function buildYearlyTransitIcs(pack: YearlyTransitFactPack, reportId: string): string {
  if (!pack || pack.reportType !== 'yearlytransit') throw new Error('invalid yearly-transit pack');
  const primaryIds = new Set(pack.aiPacks.primaryWindows.map((item) => item.id));
  const primary = pack.windows.filter((window) => primaryIds.has(window.id)).sort((a, b) => a.canonicalTransitId.localeCompare(b.canonicalTransitId) || a.activeWindow.startUtc.localeCompare(b.activeWindow.startUtc)).slice(0, 8);
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Cosmic Spirit Guide//Yearly Transit Forecast//EN', 'CALSCALE:GREGORIAN', ...line('X-CSG-DISPLAY-TIMEZONE', escapeText(pack.displayTimezone))];
  const emitted = new Set<string>();
  const emit = (window: ActiveWindow, eventType: string, instant: string, summary: string, description: string) => {
    const key = `${window.canonicalTransitId}|${eventType}|${utcValue(instant)}`;
    if (emitted.has(key)) return;
    emitted.add(key);
    lines.push(...eventLines(pack, reportId, window, eventType, instant, summary, description));
  };
  for (const window of primary) {
    const description = `${window.mover} ${window.aspectType} ${window.target}; direction ${window.segments[0]?.direction ?? 'indeterminate'}.`;
    emit(window, 'active-start', window.activeWindow.startUtc, `${window.mover} ${window.aspectType} ${window.target} window begins`, description);
    for (const hit of [...window.exactHits].sort((a, b) => a.exactUtc.localeCompare(b.exactUtc))) emit(window, 'exact-hit', hit.exactUtc, `${window.mover} exact ${window.aspectType} ${window.target}`, `Exact hit; direction ${hit.direction}.`);
    emit(window, 'active-end', window.activeWindow.endUtc, `${window.mover} ${window.aspectType} ${window.target} window ends`, description);
  }
  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}
