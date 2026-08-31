// Blog dispositions per John's 2026-08-31 ruling (overrides the older editorial queue).
// sanity-slugs.txt = live Sanity production blogPost slugs (kicslgfz/production).
//
// Ruling:
//  - 16 §4a keep-candidate posts + 7 canonical topics are MIGRATED and INDEXED
//    (REFRESH_AND_MIGRATE, indexable:true). All 16 confirmed live in Sanity prod.
//  - 15 slop duplicate-suffix variants 301 to their canonical base slug. That is
//    handled in build-manifest.mjs SAME_INTENT_301 (intercepts before this module).
//  - Any other blog slug with no Sanity source and no keeper intent => RETIRE_410.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "node:url";

// §4a keep-candidates (brief §4a) — migrate + index. All confirmed live in Sanity prod
// on 2026-08-31 (kicslgfz/dataset production). These also cover the 7 canonical bases.
const KEEPERS = new Set([
  "/blog/ai-tarot-reading-free-personalized-astrology-insights",
  "/blog/building-trust-in-digital-spirituality-a-non-judgmental-supportive-approach",
  "/blog/composite-chart-relationship-soul",
  "/blog/find-calm-in-uncertainty-simple-daily-tarot-guidance-for-peaceful-clarity",
  "/blog/finding-calm-in-the-stars-and-cards-a-guide-to-reducing-anxiety-through-tarot-and-astrology",
  "/blog/harnessing-lunar-magic-let-the-moon-s-energy-guide-your-emotions-and-actions",
  "/blog/harnessing-the-power-of-daily-personalized-guidance-for-personal-and-professional-growth",
  "/blog/how-technology-is-democratizing-spiritual-guidance-for-everyone",
  "/blog/mother-s-instinct-understanding-pregnancy-infant-temperament-and-psychology",
  "/blog/relationship-compatibility-beyond-sun",
  "/blog/rising-sign-calculator-find-your-ascendant-sign-free",
  "/blog/step-into-your-power-embrace-ai-tailored-tarot-insights-today",
  "/blog/the-future-of-fate-how-ai-powered-tarot-readings-work",
  "/blog/the-future-of-intuition-how-ai-is-transforming-spiritual-guidance",
  "/blog/twin-flame-vs-soulmate-the-real-difference-and-how-to-know-which-you-ve-met",
  "/blog/what-is-my-birth-chart",
]);

export function loadSanitySlugs() {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const raw = fs.readFileSync(path.join(here, "sanity-slugs.txt"), "utf8");
    return new Set(raw.split("\n").map((s) => s.trim()).filter(Boolean));
  } catch {
    return new Set();
  }
}

function keepRow(p, PROD) {
  return {
    disposition: "REFRESH_AND_MIGRATE",
    newPath: p,
    intendedStatus: 200,
    indexable: true,
    canonicalUrl: PROD + p,
    redirectTarget: null,
    reason: "§4a keep-candidate confirmed live in Sanity prod; migrate full metadata (canonical/og/JSON-LD) and index.",
  };
}
function retireRow(p) {
  return {
    disposition: "RETIRE_410",
    newPath: null,
    intendedStatus: 410,
    indexable: false,
    canonicalUrl: null,
    redirectTarget: "410",
    reason: "No keeper intent and no Sanity source; intentional 410 after evidence review.",
  };
}

export function decideBlog(r, sanitySlugs, PROD) {
  const p = r[0];
  const slug = p.replace("/blog/", "");

  // Blog hub is a real navigational route; stays indexable.
  if (p === "/blog" || slug === "") {
    return {
      disposition: "KEEP_AND_REBUILD",
      newPath: p,
      intendedStatus: 200,
      indexable: true,
      canonicalUrl: PROD + p,
      redirectTarget: null,
      reason: "Blog hub; indexable. Individual posts served from the live Sanity query.",
    };
  }

  // §4a keepers: migrate + index.
  if (KEEPERS.has(p)) return keepRow(p, PROD);

  // Slop duplicate-suffix variants are intercepted by build-manifest SAME_INTENT_301
  // (301 to canonical base) before reaching here.

  // Other live Sanity posts: existence only. Held pending independent approval
  // (do not auto-index unvetted posts).
  if (sanitySlugs.has(slug)) {
    return {
      disposition: "HOLD_NOINDEX",
      newPath: null,
      intendedStatus: 200,
      indexable: false,
      canonicalUrl: null,
      redirectTarget: null,
      reason: "Exists in Sanity production; held pending independent editorial approval. Not indexed until approved.",
    };
  }

  // No Sanity source, no keeper intent: retire.
  return retireRow(p);
}
