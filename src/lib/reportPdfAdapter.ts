// Adapter from the asynchronous pipeline report contract (toPublicReport) to the
// legacy PDF input shape (ReportPdfInput). ReportPdfInput and its existing
// callers are UNCHANGED; this is a typed bridge so the owner Reports tab can
// render/download n8n-approved reports without breaking report-engine call
// sites. Pure functions, no DOM. Customer PDFs omit factsCited, judge internals,
// callback tokens, and every non-approved status.

import type { ReportPdfInput } from '@/lib/reportPdf';

// The async pipeline section shape written by /api/reports/pipeline-complete and
// surfaced (approved only) by toPublicReport. All fields optional on the wire;
// empty/whitespace prose is treated as undeliverable and dropped.
export interface AsyncSection {
  id?: string;
  prose?: string;
  factsCited?: string[];
}

// Mirror of the deliverable branch of toPublicReport (src/lib/profile/store.ts).
// overview/sections are populated only when status === 'approved'; otherwise the
// route already returns them empty.
export interface AsyncPublicReport {
  id: number;
  reportId?: string | null;
  title?: string | null;
  type?: string | null;
  status?: string | null;
  overview?: { glyph?: string; label: string; value: string; note?: string }[];
  sections?: AsyncSection[];
  createdAt?: string;
}

const SECTION_HEADING_FALLBACK = 'Section';
const TITLE_FALLBACK = 'Cosmic Spirit Guide Report';

// Insert a word break at camelCase / PascalCase boundaries so ids read as words:
// "houseThemes" -> "house Themes", "planetDetail" -> "planet Detail". Handles
// acronym-to-word too ("URLParser" -> "URL Parser"). Dots and other separators
// are handled at the split step below.
function splitCamel(id: string): string {
  return id
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')   // lower/digit -> Upper
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); // acronym -> Word (e.g. URLParser)
}

// Humanize a stable pipeline id for display. The exact id is kept by callers for
// keys/tests; this only affects the visible heading. snake_case / kebab-case /
// dotted.namespaces / camelCase / runs of separators -> Title Case words.
export function humanizeSectionId(id: string | undefined | null): string {
  if (!id || typeof id !== 'string') return SECTION_HEADING_FALLBACK;
  const words = splitCamel(id)
    .split(/[^A-Za-z0-9]+/)
    .filter((w) => w.length > 0)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1));
  return words.length > 0 ? words.join(' ') : SECTION_HEADING_FALLBACK;
}

// Only 'approved' is customer-deliverable. queued/pending/needs_editor/rejected
// must never reach the PDF path.
export function isApprovedDeliverable(status: string | null | undefined): boolean {
  return status === 'approved';
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

// Map async sections to ordered {heading, body} PDF sections. Drops entries that
// are not objects, have no usable prose, or are whitespace-only. factsCited is
// deliberately never copied into the output (product default: omit from customer
// PDF). Order is preserved.
export function mapAsyncSectionsToPdf(
  sections: AsyncSection[] | undefined | null,
): { heading: string; body: string }[] {
  if (!Array.isArray(sections)) return [];
  const out: { heading: string; body: string }[] = [];
  for (const s of sections) {
    if (!s || typeof s !== 'object') continue;
    if (!isNonEmptyString(s.prose)) continue;
    out.push({ heading: humanizeSectionId(s.id), body: s.prose });
  }
  return out;
}

// Build a ReportPdfInput for an approved async report, or null when the report
// is not deliverable (non-approved, or approved but with no renderable section).
// Returns null instead of an empty PDF so the UI shows no PDF action at all.
export function asyncReportToPdfInput(report: AsyncPublicReport): ReportPdfInput | null {
  if (!report || !isApprovedDeliverable(report.status)) return null;
  const sections = mapAsyncSectionsToPdf(report.sections);
  if (sections.length === 0) return null;
  return {
    type: isNonEmptyString(report.type) ? report.type : 'report',
    title: isNonEmptyString(report.title) ? report.title : TITLE_FALLBACK,
    overview: Array.isArray(report.overview) ? report.overview : [],
    sections,
  };
}
