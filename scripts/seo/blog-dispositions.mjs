// Evidence-backed blog dispositions (Workstream C).
// sanity-slugs.txt = live Sanity production blogPost slugs (kicslgfz/production),
// captured by scripts/seo/sanity-probe.mjs from real production data.
import fs from "fs";
import path from "path";

export const BLOG_OVERRIDES = {
  "/blog/free-moon-sign-calculator-discover-your-emotional-core-2": { d: "MERGE_AND_301", t: "/blog/free-moon-sign-calculator-discover-your-emotional-core-1", r: "Duplicate date-suffixed variant of the canonical Sanity post; 301 to canonical." },
  "/blog/twin-flame-compatibility-test-are-they-your-other-half-1": { d: "MERGE_AND_301", t: "/blog/twin-flame-vs-soulmate-the-real-difference-and-how-to-know-which-you-ve-met", r: "Thin variant of the canonical twin-flame/soulmate post; 301 to it." },
  "/blog/twin-flame-compatibility-test-are-they-your-other-half-2": { d: "MERGE_AND_301", t: "/blog/twin-flame-vs-soulmate-the-real-difference-and-how-to-know-which-you-ve-met", r: "Thin variant of the canonical twin-flame/soulmate post; 301 to it." },
  "/blog/ai-tarot-reading-free-personalized-astrology-insights": { d: "301_EQUIVALENT", t: "/tarot", r: "Promo landing for tarot; equivalent canonical is /tarot." },
  "/blog/find-calm-in-uncertainty-simple-daily-tarot-guidance-for-peaceful-clarity": { d: "301_EQUIVALENT", t: "/tarot", r: "Daily-tarot promo; equivalent canonical is /tarot." },
  "/blog/step-into-your-power-embrace-ai-tailored-tarot-insights-today": { d: "301_EQUIVALENT", t: "/tarot", r: "AI tarot CTA; equivalent canonical is /tarot." },
  "/blog/the-future-of-fate-how-ai-powered-tarot-readings-work": { d: "301_EQUIVALENT", t: "/tarot", r: "How-AI-tarot editorial; equivalent canonical is /tarot." },
  "/blog/free-zodiac-compatibility-calculator-find-your-cosmic-match-1": { d: "301_EQUIVALENT", t: "/compatibility", r: "Calculator landing; equivalent tool is /compatibility." },
  "/blog/free-zodiac-compatibility-calculator-find-your-cosmic-match-11": { d: "301_EQUIVALENT", t: "/compatibility", r: "Calculator landing; equivalent tool is /compatibility." },
  "/blog/love-compatibility-by-birth-date-the-complete-guide-1": { d: "301_EQUIVALENT", t: "/compatibility", r: "Compatibility editorial; equivalent tool is /compatibility." },
  "/blog/love-compatibility-by-birth-date-the-complete-guide-5": { d: "301_EQUIVALENT", t: "/compatibility", r: "Compatibility editorial; equivalent tool is /compatibility." },
  "/blog/how-to-read-your-birth-chart-a-beginner-s-visual-guide-1": { d: "301_EQUIVALENT", t: "/birth-chart", r: "Birth-chart guide; equivalent tool is /birth-chart." },
  "/blog/how-to-read-your-birth-chart-a-beginner-s-visual-guide-2": { d: "301_EQUIVALENT", t: "/birth-chart", r: "Birth-chart guide; equivalent tool is /birth-chart." },
  "/blog/rising-sign-calculator-find-your-ascendant-sign-free": { d: "301_EQUIVALENT", t: "/birth-chart", r: "Rising/ascendant is part of the birth chart; equivalent is /birth-chart." },
  "/blog/rising-sign-calculator-find-your-ascendant-sign-free-2": { d: "301_EQUIVALENT", t: "/birth-chart", r: "Rising/ascendant is part of the birth chart; equivalent is /birth-chart." },
  "/blog/what-is-my-birth-chart": { d: "301_EQUIVALENT", t: "/birth-chart", r: "Birth-chart explainer; equivalent tool is /birth-chart." },
  "/blog/harnessing-the-power-of-daily-personalized-guidance-for-personal-and-professional-growth": { d: "301_EQUIVALENT", t: "/", r: "Product/growth promo; equivalent canonical is the homepage." },
  "/blog/building-trust-in-digital-spirituality-a-non-judgmental-supportive-approach": { d: "RETIRE_410", t: null, r: "No Sanity source, no equivalent launch route; intentional 410 after evidence review." },
  "/blog/composite-chart-relationship-soul": { d: "RETIRE_410", t: null, r: "Synastry/composite feature unlaunched; no equivalent route; 410." },
  "/blog/finding-calm-in-the-stars-and-cards-a-guide-to-reducing-anxiety-through-tarot-and-astrology": { d: "RETIRE_410", t: null, r: "No Sanity source, no equivalent tool; 410." },
  "/blog/harnessing-lunar-magic-let-the-moon-s-energy-guide-your-emotions-and-actions": { d: "RETIRE_410", t: null, r: "No Sanity source, no equivalent tool; 410." },
  "/blog/mercury-retrograde-meaning-complete-survival-guide-1": { d: "RETIRE_410", t: null, r: "No transit content served on new site; no equivalent; 410." },
  "/blog/mercury-retrograde-meaning-complete-survival-guide-2": { d: "RETIRE_410", t: null, r: "No transit content served on new site; no equivalent; 410." },
  "/blog/mother-s-instinct-understanding-pregnancy-infant-temperament-and-psychology": { d: "RETIRE_410", t: null, r: "Off-mission topic, no Sanity source; 410." },
  "/blog/numerology-compatibility-calculator-life-path-numbers-1": { d: "RETIRE_410", t: null, r: "No numerology feature on new site; no equivalent; 410." },
  "/blog/numerology-compatibility-calculator-life-path-numbers-2": { d: "RETIRE_410", t: null, r: "No numerology feature on new site; no equivalent; 410." },
  "/blog/the-future-of-intuition-how-ai-is-transforming-spiritual-guidance": { d: "RETIRE_410", t: null, r: "Generic AI-spirituality editorial, no Sanity source; 410." },
};

export function loadSanitySlugs() {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), "scripts", "seo", "sanity-slugs.txt"), "utf8");
    return new Set(raw.split("\n").map((s) => s.trim()).filter(Boolean));
  } catch {
    return new Set();
  }
}

export function decideBlog(r, sanitySlugs, PROD) {
  const p = r[0];
  const slug = p.replace("/blog/", "");
  if (slug === "") {
    return { disposition: "KEEP_AND_REBUILD", newPath: p, intendedStatus: 200, indexable: true, canonicalUrl: PROD + p, redirectTarget: null, reason: "Blog hub; indexable. Real posts served from Sanity production." };
  }
  if (sanitySlugs.has(slug)) {
    return { disposition: "KEEP_AND_REBUILD", newPath: p, intendedStatus: 200, indexable: true, canonicalUrl: PROD + p, redirectTarget: null, reason: "Matches a live Sanity blogPost slug; verify metadata/canonical, refresh if stale." };
  }
  const ov = BLOG_OVERRIDES[p];
  if (ov) {
    const is410 = ov.d === "RETIRE_410";
    return {
      disposition: ov.d,
      newPath: is410 ? null : ov.t,
      intendedStatus: is410 ? 410 : 301,
      indexable: !is410,
      canonicalUrl: is410 ? null : PROD + ov.t,
      redirectTarget: is410 ? "410" : PROD + ov.t,
      reason: ov.r,
    };
  }
  return { disposition: "RETIRE_410", newPath: null, intendedStatus: 410, indexable: false, canonicalUrl: null, redirectTarget: "410", reason: "No matching Sanity blogPost and no equivalent launch route; intentional 410 after evidence review." };
}
