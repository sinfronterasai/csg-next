// Evidence-backed blog dispositions (Workstream C).
// sanity-slugs.txt = live Sanity production blogPost slugs (kicslgfz/production),
// captured by scripts/seo/sanity-probe.mjs from real production data.
//
// C6 / editorial queue E: a static slug proves EXISTENCE only. Independent editorial
// approval (reviewStatus == "approved" + zero hard-fail flags) is what makes a post
// public. The public sitemap/queries use the LIVE fail-closed query, never this list.
// Therefore every blog slug row is HOLD_NOINDEX until approved; the hub (/blog) is a
// real navigational route and stays indexable.
//
// C5 / editorial queue A: do NOT 301 an article intent to a tool/held target merely
// to avoid a 404. MERGE/REFRESH candidates are held (HOLD_NOINDEX) until an approved
// same-intent destination exists; only explicit retire cases are 410.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "node:url";

// Dispositions that hold a page (noindex, no 301 target) pending editorial approval.
const HOLD = "HOLD_NOINDEX";

// Explicit retire cases (A3 / numerology / off-core). Real 410.
const RETIRE = "RETIRE_410";

// Each entry: d = HOLD or RETIRE; for RETIRE t is null. reason cites the queue.
export const BLOG_OVERRIDES = {
  // ---- AI tarot cluster (A2 MERGE/HOLD) -> hold, do not 301 to /tarot ----
  "/blog/ai-tarot-reading-free-personalized-astrology-insights": { d: HOLD, r: "AI-tarot cluster (A2 MERGE/HOLD); held until the approved AI-tarot pillar exists. No 301 to tool." },
  "/blog/the-future-of-fate-how-ai-powered-tarot-readings-work": { d: HOLD, r: "AI-tarot cluster (A2 MERGE/HOLD); held until approved pillar. No 301 to tool." },
  "/blog/free-zodiac-compatibility-calculator-find-your-cosmic-match-1": { d: HOLD, r: "Compatibility cluster (A2 MERGE/HOLD); held until approved compatibility pillar. No 301 to tool." },
  "/blog/free-zodiac-compatibility-calculator-find-your-cosmic-match-11": { d: HOLD, r: "Compatibility cluster (A2 MERGE/HOLD); held until approved compatibility pillar. No 301 to tool." },
  "/blog/love-compatibility-by-birth-date-the-complete-guide-1": { d: HOLD, r: "Compatibility cluster (A2 MERGE/HOLD); held until approved pillar. No 301 to tool." },
  "/blog/love-compatibility-by-birth-date-the-complete-guide-5": { d: HOLD, r: "Compatibility cluster (A2 MERGE/HOLD); held until approved pillar. No 301 to tool." },
  "/blog/how-to-read-your-birth-chart-a-beginner-s-visual-guide-1": { d: HOLD, r: "Birth-chart cluster (A2 MERGE/REFRESH); held until approved pillar. No 301 to tool." },
  "/blog/how-to-read-your-birth-chart-a-beginner-s-visual-guide-2": { d: HOLD, r: "Birth-chart cluster (A2 MERGE/REFRESH); held until approved pillar. No 301 to tool." },
  "/blog/rising-sign-calculator-find-your-ascendant-sign-free": { d: HOLD, r: "Birth-chart cluster (A2 MERGE/REFRESH); held until approved pillar. No 301 to tool." },
  "/blog/rising-sign-calculator-find-your-ascendant-sign-free-2": { d: HOLD, r: "Birth-chart cluster (A2 MERGE/REFRESH); held until approved pillar. No 301 to tool." },
  "/blog/what-is-my-birth-chart": { d: HOLD, r: "Birth-chart pillar candidate (A1 REFRESH P0); held until the refreshed approved pillar is live. No 301 to tool." },
  "/blog/step-into-your-power-embrace-ai-tailored-tarot-insights-today": { d: RETIRE, r: "A3 RETIRE CURRENT COPY: same placeholder body group, promotional framing." },
  "/blog/harnessing-the-power-of-daily-personalized-guidance-for-personal-and-professional-growth": { d: RETIRE, r: "A3 RETIRE CURRENT COPY: placeholder-body duplication; not editorially approved." },

  // ---- Moon-sign cluster (A2 MERGE/HOLD) ----
  "/blog/free-moon-sign-calculator-discover-your-emotional-core-2": { d: HOLD, r: "Moon-sign cluster (A2 MERGE/HOLD); one-hop 301 only after the canonical Sanity post is approved. Held." },
  "/blog/find-calm-in-uncertainty-simple-daily-tarot-guidance-for-peaceful-clarity": { d: RETIRE, r: "A3 RETIRE CURRENT COPY: shares placeholder body with unrelated pages." },
  "/blog/harnessing-lunar-magic-let-the-moon-s-energy-guide-your-emotions-and-actions": { d: RETIRE, r: "A3 RETIRE CURRENT COPY: same placeholder-body group; no approved unique value." },
  "/blog/how-technology-is-democratizing-spiritual-guidance-for-everyone": { d: RETIRE, r: "A3 RETIRE CURRENT COPY: same placeholder-body group; intent only reconsidered in AI-tarot pillar." },

  // ---- Twin-flame cluster (A2 MERGE/HOLD) ----
  "/blog/twin-flame-compatibility-test-are-they-your-other-half-1": { d: HOLD, r: "Twin-flame cluster (A2 MERGE/HOLD); held until canonical passes safety review. No 301." },
  "/blog/twin-flame-compatibility-test-are-they-your-other-half-2": { d: HOLD, r: "Twin-flame cluster (A2 MERGE/HOLD); held until canonical passes safety review. No 301." },

  // ---- Explicit retire (off-core / no source / no equivalent) ----
  "/blog/building-trust-in-digital-spirituality-a-non-judgmental-supportive-approach": { d: RETIRE, r: "A3 RETIRE: no Sanity source, no equivalent launch route." },
  "/blog/composite-chart-relationship-soul": { d: RETIRE, r: "Synastry/composite feature unlaunched; no equivalent route; 410." },
  "/blog/finding-calm-in-the-stars-and-cards-a-guide-to-reducing-anxiety-through-tarot-and-astrology": { d: HOLD, r: "A3 RETIRE/HOLD: mental-health intent needs qualified review; held, not republished." },
  "/blog/mercury-retrograde-meaning-complete-survival-guide-1": { d: RETIRE, r: "No transit content served on new site; no equivalent; 410." },
  "/blog/mercury-retrograde-meaning-complete-survival-guide-2": { d: RETIRE, r: "No transit content served on new site; no equivalent; 410." },
  "/blog/mother-s-instinct-understanding-pregnancy-infant-temperament-and-psychology": { d: RETIRE, r: "Off-core, sensitive pregnancy/infant psychology, unsupported; no redirect." },
  "/blog/numerology-compatibility-calculator-life-path-numbers-1": { d: RETIRE, r: "No verified CSG numerology offering; 410 (A2 HOLD/RETIRE)." },
  "/blog/numerology-compatibility-calculator-life-path-numbers-2": { d: RETIRE, r: "No verified CSG numerology offering; 410 (A2 HOLD/RETIRE)." },
  "/blog/the-future-of-intuition-how-ai-is-transforming-spiritual-guidance": { d: RETIRE, r: "A3 RETIRE CURRENT COPY: same placeholder-body group." },
};

export function loadSanitySlugs() {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const raw = fs.readFileSync(path.join(here, "sanity-slugs.txt"), "utf8");
    return new Set(raw.split("\n").map((s) => s.trim()).filter(Boolean));
  } catch {
    return new Set();
  }
}

// Build a single blog disposition row.
// indexable is always false for held/retired blog content (C4/C6).
function holdRow(p, reason) {
  return {
    disposition: "HOLD_NOINDEX",
    newPath: null,
    intendedStatus: 200,
    indexable: false,
    canonicalUrl: null,
    redirectTarget: null,
    reason,
  };
}
function retireRow(p, reason) {
  return {
    disposition: "RETIRE_410",
    newPath: null,
    intendedStatus: 410,
    indexable: false,
    canonicalUrl: null,
    redirectTarget: "410",
    reason,
  };
}

export function decideBlog(r, sanitySlugs, PROD) {
  const p = r[0];
  const slug = p.replace("/blog/", "");

  // Blog hub is a real navigational route; stays indexable. Real posts come from
  // the live fail-closed Sanity query (separate authority).
  if (p === "/blog" || slug === "") {
    return {
      disposition: "KEEP_AND_REBUILD",
      newPath: p,
      intendedStatus: 200,
      indexable: true,
      canonicalUrl: PROD + p,
      redirectTarget: null,
      reason: "Blog hub; indexable. Individual posts served only from the live fail-closed Sanity query (approved + published).",
    };
  }

  // Explicit override (editorial queue decision).
  const ov = BLOG_OVERRIDES[p];
  if (ov) {
    return ov.d === RETIRE ? retireRow(p, ov.r) : holdRow(p, ov.r);
  }

  // Existing Sanity slug: existence only, NOT approval (C6). Held until approved.
  if (sanitySlugs.has(slug)) {
    return holdRow(
      p,
      "Exists in Sanity production; held pending independent editorial approval (reviewStatus == approved + zero hard-fail flags). Not indexed until approved."
    );
  }

  // No Sanity source, no equivalent launch route: retire.
  return retireRow(
    p,
    "No matching Sanity blogPost and no equivalent launch route; intentional 410 after evidence review."
  );
}
