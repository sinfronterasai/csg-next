// Dependency-free PDF path for reports: open a print-friendly window and
// trigger the browser "Save as PDF" dialog. Mirrors src/lib/tarot/pdf.ts but
// renders the report's structured overview + sections (no per-card imagery).
//
// The single report engine (reportEngine.ts) produces `overview` (Layer 1) and
// `sections` (Layer 2). The async pipeline path reaches this same function via
// src/lib/reportPdfAdapter.ts, which maps {id, prose} sections to the
// {heading, body} shape below. ReportPdfInput is unchanged so existing
// report-engine callers (e.g. ReportResult) keep working.

export interface ReportPdfInput {
  type: string;
  title: string;
  overview: { glyph?: string; label: string; value: string; note?: string }[];
  sections: { heading: string; body: string }[];
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Preserve **bold** markers for lightweight emphasis in the print view.
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

export function exportReportPdf(input: ReportPdfInput) {
  if (typeof window === 'undefined') return;
  const w = window.open('', '_blank', 'width=720,height=900');
  // Popup blocked (or otherwise unavailable): fail gracefully, leave the control
  // usable, never throw into the caller.
  if (!w) return;

  // Empty overview must not render an empty table/thead husk.
  const hasOverview = Array.isArray(input.overview) && input.overview.length > 0;
  const rows = hasOverview
    ? input.overview
        .map(
          (r) =>
            `<tr><td style="padding:6px 10px;border-bottom:1px solid #e7d9a8">${r.glyph ? r.glyph + ' ' : ''}<strong>${escapeHtml(r.label)}</strong></td>` +
            `<td style="padding:6px 10px;border-bottom:1px solid #e7d9a8">${escapeHtml(r.value)}</td>` +
            `<td style="padding:6px 10px;border-bottom:1px solid #e7d9a8;color:#7a7f93;font-size:13px">${escapeHtml(r.note ?? '')}</td></tr>`,
        )
        .join('')
    : '';

  // Sections flow naturally. We deliberately do NOT make each .sec indivisible
  // (that forced a mostly-blank final page). Instead each heading carries
  // break-after:avoid so it stays with its first body lines, and the body uses
  // orphans/widows so no lone line strands across a page break.
  const body = input.sections
    .map(
      (s) =>
        `<section class="sec">` +
        `<h2>${escapeHtml(s.heading)}</h2>` +
        `<div class="bd">${escapeHtml(s.body)}</div>` +
        `</section>`,
    )
    .join('');

  const tableBlock = hasOverview
    ? `<table><thead><tr><th style="text-align:left;padding:6px 10px">Point</th><th style="text-align:left;padding:6px 10px">Position</th><th style="text-align:left;padding:6px 10px">Note</th></tr></thead><tbody>${rows}</tbody></table>`
    : '';

  w.document.write(`<!doctype html><html><head><title>Cosmic Spirit Guide &mdash; ${escapeHtml(input.title)}</title>
    <style>
      body{font-family:Georgia,serif;color:#1f2233;background:#fbfaf6;padding:36px 36px 72px;max-width:680px;margin:auto}
      .brand{display:flex;align-items:center;gap:12px;border-bottom:2px solid #c9a227;padding-bottom:14px;margin-bottom:20px}
      .brand h1{font-size:20px;color:#9a6b1f;margin:0;letter-spacing:.5px}
      .brand p{margin:2px 0 0;font-size:12px;color:#7a7f93}
      h1.t{font-size:18px;color:#9a6b1f;margin:0 0 4px}
      table{width:100%;border-collapse:collapse;margin-top:8px;font-size:14px}
      thead th{color:#9a6b1f;font-size:12px;text-transform:uppercase;letter-spacing:.5px}
      .sec{margin-top:22px}
      .sec h2{font-size:16px;color:#9a6b1f;margin:0 0 6px;border-bottom:1px solid #e7d9a8;padding-bottom:4px;break-after:avoid;page-break-after:avoid}
      .sec .bd{white-space:pre-line;line-height:1.7;color:#1f2233;orphans:3;widows:3}
      .foot{position:fixed;bottom:0;left:0;right:0;border-top:2px solid #c9a227;padding-top:8px;font-size:11px;color:#7a7f93;text-align:center;letter-spacing:.5px;background:#fbfaf6}
      @page{margin:18mm 16mm 22mm}
      @media print{
        body{padding:0 0 24mm;max-width:none}
        .sec h2{break-after:avoid;page-break-after:avoid}
      }
    </style></head><body>
    <div class="brand"><div><h1>Cosmic Spirit Guide</h1><p>Personalized Report</p></div></div>
    <h1 class="t">${escapeHtml(input.title)}</h1>
    ${tableBlock}
    ${body}
    <div class="foot">cosmicspiritguide.com</div>
    </body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 500);
}
