"use client";

import type { ReadingViewModel } from "@/lib/tarot/view";

/**
 * Open a print-friendly window for the reading and trigger the print dialog.
 * This is a real, dependency-free PDF path (browser "Save as PDF").
 */
export function exportReadingPdf(reading: ReadingViewModel) {
  if (typeof window === "undefined") return;
  const w = window.open("", "_blank", "width=720,height=900");
  if (!w) return;
  const cards = reading.cards
    .map(
      (c) =>
        `<li><strong>${c.positionLabel}:</strong> ${c.name} ${c.reversed ? "(Reversed)" : ""} &mdash; ${c.meaning}</li>`,
    )
    .join("");
  const astro = reading.astrology
    ? `<p><em>Astrology blend:</em> ${reading.astrology.summary}</p>`
    : "";
  w.document.write(`<!doctype html><html><head><title>Tarot Reading</title>
    <style>body{font-family:Georgia,serif;color:#1a1a1a;padding:32px;max-width:640px;margin:auto}
    h1{font-size:22px}h2{font-size:16px;margin-top:24px}ul{line-height:1.6}.astro{color:#6b5b2e;margin-top:8px}
    .int{white-space:pre-line;line-height:1.7}</style></head><body>
    <h1>${reading.question}</h1>
    ${astro}
    <h2>Your Cards</h2><ul>${cards}</ul>
    <h2>Reading</h2><div class="int">${reading.interpretation}</div>
    </body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}
