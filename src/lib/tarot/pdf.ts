"use client";

import type { ReadingViewModel } from "@/lib/tarot/view";
import { CARD_BACK_URL } from "@/lib/tarot/deck";

/**
 * Open a print-friendly window for the reading and trigger the print dialog.
 * Real, dependency-free PDF path (browser "Save as PDF"). Branded with the
 * Cosmic Spirit Guide identity and includes each drawn card's real image.
 */
export function exportReadingPdf(reading: ReadingViewModel) {
  if (typeof window === "undefined") return;
  const w = window.open("", "_blank", "width=720,height=900");
  if (!w) return;

  const origin = window.location.origin;
  const back = origin + CARD_BACK_URL;

  const cards = reading.cards
    .map((c) => {
      const img = c.artRef
        ? `<img src="${c.artRef}" alt="${c.name}" style="width:64px;height:auto;border-radius:8px;border:1px solid #c9a227;margin-right:12px;flex:0 0 auto" />`
        : "";
      return `<li style="display:flex;align-items:center;margin-bottom:12px">
        ${img}
        <span><strong style="color:#9a6b1f">${c.positionLabel}:</strong> ${c.name} ${
          c.reversed ? "(Reversed)" : ""
        } &mdash; ${c.meaning}</span>
      </li>`;
    })
    .join("");

  const astro = reading.astrology
    ? `<p style="color:#8a6d1f;margin-top:8px;font-style:italic">Astrology blend: ${reading.astrology.summary}</p>`
    : "";

  w.document.write(`<!doctype html><html><head><title>Cosmic Spirit Guide &mdash; Tarot Reading</title>
    <style>
      body{font-family:Georgia,serif;color:#1f2233;background:#fbfaf6;padding:36px;max-width:680px;margin:auto}
      .brand{display:flex;align-items:center;gap:12px;border-bottom:2px solid #c9a227;padding-bottom:14px;margin-bottom:20px}
      .brand img{width:48px;height:64px;border-radius:6px;box-shadow:0 1px 4px rgba(0,0,0,.2)}
      .brand h1{font-size:20px;color:#9a6b1f;margin:0;letter-spacing:.5px}
      .brand p{margin:2px 0 0;font-size:12px;color:#7a7f93}
      h1.q{font-size:18px;color:#9a6b1f;margin:0 0 4px}
      h2{font-size:16px;color:#9a6b1f;margin-top:24px;border-bottom:1px solid #e7d9a8;padding-bottom:4px}
      ul{list-style:none;padding:0;line-height:1.6}
      .astro{color:#8a6d1f;margin-top:8px;font-style:italic}
      .int{white-space:pre-line;line-height:1.7}
      .foot{margin-top:28px;border-top:2px solid #c9a227;padding-top:12px;font-size:11px;color:#7a7f93;text-align:center;letter-spacing:.5px}
    </style></head><body>
    <div class="brand"><img src="${back}" alt="Cosmic Spirit Guide" /><div><h1>Cosmic Spirit Guide</h1><p>Tarot Reading</p></div></div>
    <h1 class="q">${reading.question}</h1>
    ${astro}
    <h2>Your Cards</h2><ul>${cards}</ul>
    <h2>Reading</h2><div class="int">${reading.interpretation}</div>
    <div class="foot">cosmicspiritguide.com</div>
    </body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 500);
}
