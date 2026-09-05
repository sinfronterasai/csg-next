// Deterministic mirror generator. Reads the audit CSV and emits docs/seo/legacy-url-migration-manifest.json.
// Disposition logic is centralized here (the integration owner's canonical IA).
// Portable: CSV resolved relative to THIS script (committed at docs/seo/evidence/route-parity-audit.csv).
// Missing input fails the process with a nonzero exit code.
//
// REDIRECT semantics are OVERRIDDEN by John's canonical map at
// /workspace/seo-migration/redirects-map.csv (sha256 d8112628...). That map is
// authoritative and supersedes any hand-rolled redirect logic. The SAME_INTENT_301
// table below is transcribed verbatim from that map's 24 REDIRECT rows (zero 410s,
// all one-hop, none to homepage).
import fs from "fs";
import path from "path";
import { fileURLToPath } from "node:url";
import { loadSanitySlugs, decideBlog } from "./blog-dispositions.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const CSV = path.join(SCRIPT_DIR, "..", "..", "docs", "seo", "evidence", "route-parity-audit.csv");
const OUT = path.join(SCRIPT_DIR, "..", "..", "docs", "seo", "legacy-url-migration-manifest.json");
const PROD = "https://cosmicspiritguide.com";

// Verbatim from /workspace/seo-migration/redirects-map.csv (24 REDIRECT rows).
// All one-hop 301s to same-intent hubs. Zero 410s. Never homepage.
const SAME_INTENT_301 = {
  "/blog/free-moon-sign-calculator-discover-your-emotional-core-1": "/blog/free-moon-sign-calculator-discover-your-emotional-core",
  "/blog/free-moon-sign-calculator-discover-your-emotional-core-2": "/blog/free-moon-sign-calculator-discover-your-emotional-core",
  "/blog/free-zodiac-compatibility-calculator-find-your-cosmic-match-1": "/blog/free-zodiac-compatibility-calculator-find-your-cosmic-match",
  "/blog/free-zodiac-compatibility-calculator-find-your-cosmic-match-11": "/blog/free-zodiac-compatibility-calculator-find-your-cosmic-match",
  "/blog/free-zodiac-compatibility-calculator-find-your-cosmic-match-2": "/blog/free-zodiac-compatibility-calculator-find-your-cosmic-match",
  "/blog/how-to-read-your-birth-chart-a-beginner-s-visual-guide-1": "/blog/how-to-read-your-birth-chart-a-beginner-s-visual-guide",
  "/blog/how-to-read-your-birth-chart-a-beginner-s-visual-guide-2": "/blog/how-to-read-your-birth-chart-a-beginner-s-visual-guide",
  "/blog/love-compatibility-by-birth-date-the-complete-guide-1": "/blog/love-compatibility-by-birth-date-the-complete-guide",
  "/blog/love-compatibility-by-birth-date-the-complete-guide-2": "/blog/love-compatibility-by-birth-date-the-complete-guide",
  "/blog/love-compatibility-by-birth-date-the-complete-guide-5": "/blog/love-compatibility-by-birth-date-the-complete-guide",
  "/blog/mercury-retrograde-meaning-complete-survival-guide-1": "/blog/mercury-retrograde-meaning-complete-survival-guide",
  "/blog/mercury-retrograde-meaning-complete-survival-guide-2": "/blog/mercury-retrograde-meaning-complete-survival-guide",
  "/blog/numerology-compatibility-calculator-life-path-numbers-1": "/blog/numerology-compatibility-calculator-life-path-numbers",
  "/blog/numerology-compatibility-calculator-life-path-numbers-2": "/blog/numerology-compatibility-calculator-life-path-numbers",
  "/blog/rising-sign-calculator-find-your-ascendant-sign-free-2": "/blog/rising-sign-calculator-find-your-ascendant-sign-free",
  "/blog/twin-flame-compatibility-test-are-they-your-other-half-1": "/blog/twin-flame-compatibility-test-are-they-your-other-half",
  "/blog/twin-flame-compatibility-test-are-they-your-other-half-2": "/blog/twin-flame-compatibility-test-are-they-your-other-half",
  "/coach": "/services",
  "/credits": "/pricing",
  "/energy": "/transits",
  "/forecasts": "/transits",
  "/moon-phase": "/transits",
  "/moon-reading": "/birth-chart",
  "/newsletter": "/blog",
  "/subscription": "/pricing",
};

if (!fs.existsSync(CSV)) {
  console.error("FATAL: audit CSV not found at " + CSV);
  process.exit(1);
}

function parseLine(line) {
  const out = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (q && line[i + 1] === '"') { cur += '"'; i++; }
      else q = !q;
      continue;
    }
    if (c === "," && !q) { out.push(cur); cur = ""; continue; }
    cur += c;
  }
  out.push(cur);
  return out;
}

const raw = fs.readFileSync(CSV, "utf8");
const lines = raw.split("\n").filter((l) => l.length > 0);
const rows = lines.slice(1).map(parseLine);

function familyOf(p) {
  const seg = p.split("/")[1] || "";
  return "/" + seg;
}

function decide(r, sanitySlugs) {
  const p = r[0];
  const fam = familyOf(p);
  const newStatus = r[3];

  // Canonical redirect map (John's redirects-map.csv) wins.
  if (SAME_INTENT_301[p]) {
    const target = PROD + SAME_INTENT_301[p];
    return mk("MERGE_AND_301", SAME_INTENT_301[p], 301, false, target, target,
      "Canonical-same-intent 301 per /workspace/seo-migration/redirects-map.csv (authoritative). One-hop, never homepage.");
  }

  if (fam === "/astrology") {
    if (p === "/astrology") return mk("KEEP_AND_REBUILD", p, 200, true, PROD + p, null, "Astrology hub; indexable navigational route.");
    return mk("KEEP_AND_REBUILD", p, 200, false, PROD + p, null, "Sun/Moon combo: live deterministic content; NOINDEX until spot-reviewed.");
  }
  if (fam === "/zodiac") {
    return mk("KEEP_AND_REBUILD", p, 200, true, PROD + p, null, "Zodiac sign page; curated, distinct per sign; indexable.");
  }
  if (fam === "/compatibility") {
    if (p === "/compatibility") return mk("KEEP_AND_REBUILD", p, 200, true, PROD + p, null, "Compatibility hub; indexable.");
    const slug = p.replace("/compatibility/", "");
    const parts = slug.split("-and-");
    if (parts.length === 2) {
      const [a, b] = parts.sort();
      const can = "/compatibility/" + a + "-and-" + b;
      if (can !== p) return mk("MERGE_AND_301", can, 301, false, PROD + can, PROD + can, "Non-canonical ordering; 301 to alphabetical canonical pair.");
      return mk("KEEP_AND_REBUILD", p, 200, false, PROD + p, null, "Canonical love-pair: live deterministic content; NOINDEX until spot-reviewed.");
    }
    return mk("KEEP_AND_REBUILD", p, 200, true, PROD + p, null, "Compatibility hub; indexable.");
  }
  if (fam === "/transits") {
    return mk("KEEP_AND_REBUILD", p, 200, false, PROD + p, null, "Transit page: live evergreen explainer; NOINDEX until real ephemeris wired.");
  }
  if (fam === "/horoscope") {
    if (p === "/horoscope") return mk("KEEP_AND_REBUILD", p, 200, true, PROD + p, null, "Horoscope hub; indexable.");
    return mk("KEEP_AND_REBUILD", p, 200, false, PROD + p, null, "Horoscope sign page: live evergreen guidance; NOINDEX until daily content wired.");
  }

  if (fam === "/blog") return decideBlog(r, sanitySlugs, PROD);

  if (fam === "/tarot") return mk("KEEP_AND_REBUILD", p, 200, true, PROD + p, null, "Tarot card page from deck data; canonical + schema.");

  if (p === "/") return mk("KEEP_AND_REBUILD", "/", 200, true, PROD + "/", null, "Homepage/entity. Launch products only; Organization/WebSite JSON-LD.");
  if (["/about","/contact","/privacy","/terms"].includes(p))
    return mk("KEEP_AND_REBUILD", p, 200, true, PROD + p, null, "Trust/legal/entity page; honest launch copy, indexable.");
  if (["/birth-chart","/constellations"].includes(p))
    return mk("REFRESH_AND_MIGRATE", p, 200, true, PROD + p, null, "Resolves on new build; migrate real metadata.");

  if (["/login","/reset-password"].includes(p))
    return mk("NOINDEX_UTILITY", p, 200, false, PROD + p, null, "Account/utility route; reachable, noindex, excluded from sitemap.");
  if (["/dashboard","/journal"].includes(p))
    return mk("NOINDEX_UTILITY", p, 200, false, PROD + p, null, "Account/utility route; reachable, noindex, excluded from sitemap (John map: REBUILD_SAME_PATH_NOINDEX).");
  if (["/profile"].includes(p))
    return mk("KEEP_AND_REBUILD", p, 200, true, PROD + p, null, "Canonical account/profile route; reachable, indexable navigation.");
  if (p === "/reports")
    return mk("NOINDEX_UTILITY", p, 200, false, PROD + p, null, "Product/checkout route; reachable, noindex (indexable only when commercial launch authorized).");

  if (["/pricing","/services"].includes(p))
    return mk("KEEP_AND_REBUILD", p, 200, true, PROD + p, null, "Commercial hub listing only live SKUs; indexable.");

  if (newStatus === "200") return mk("KEEP_AND_REBUILD", p, 200, true, PROD + p, null, "Resolves on new build; review.");
  return mk("RETIRE_410", null, 410, false, null, "410", "No healthy legacy and no launch intent; retire.");

  function mk(disposition, newPath, intendedStatus, indexable, canonicalUrl, redirectTarget, reason) {
    return { disposition, newPath, intendedStatus, indexable, canonicalUrl, redirectTarget, reason };
  }
}

const sanitySlugs = loadSanitySlugs();
const manifests = [];
for (const r of rows) {
  const d = decide(r, sanitySlugs);
  manifests.push({
    oldPath: r[0],
    oldStatus: r[2],
    routeFamily: familyOf(r[0]),
    newPath: d.newPath,
    intendedStatus: d.intendedStatus,
    indexable: d.indexable,
    canonicalUrl: d.canonicalUrl,
    disposition: d.disposition,
    redirectTarget: d.redirectTarget,
    reason: d.reason,
  });
}

const seen = new Set();
let dup = 0;
for (const m of manifests) { if (seen.has(m.oldPath)) dup++; seen.add(m.oldPath); }

fs.writeFileSync(OUT, JSON.stringify(manifests, null, 2) + "\n");

const REDIRECT_OUT = path.join(SCRIPT_DIR, "..", "..", "src", "lib", "seo", "redirect-map.ts");
const mapEntries = [];
for (const m of manifests) {
  if ((m.disposition === "MERGE_AND_301" || m.disposition === "301_EQUIVALENT") && m.redirectTarget && m.redirectTarget !== "410") {
    mapEntries.push('  ' + JSON.stringify(m.oldPath) + ': { status: 301, target: ' + JSON.stringify(m.redirectTarget) + ' },');
  } else if (m.disposition === "RETIRE_410") {
    mapEntries.push('  ' + JSON.stringify(m.oldPath) + ': { status: 410, target: null },');
  }
}
const mapSrc =
  '// AUTO-GENERATED from docs/seo/legacy-url-migration-manifest.json by scripts/seo/build-manifest.mjs.\n' +
  '// Edge-safe redirect map (no fs/node). Used by middleware.\n' +
  '// NOTE: redirect semantics follow /workspace/seo-migration/redirects-map.csv (authoritative).\n' +
  'export interface EdgeRedirect { status: 301 | 410; target: string | null; }\n' +
  'export const REDIRECT_MAP: Record<string, EdgeRedirect> = {\n' +
  mapEntries.join("\n") + '\n};\n';
fs.writeFileSync(REDIRECT_OUT, mapSrc);
console.log("WROTE " + REDIRECT_OUT + " redirect entries: " + mapEntries.length);

const counts = {};
for (const m of manifests) counts[m.disposition] = (counts[m.disposition] || 0) + 1;
console.log("WROTE " + OUT + " rows: " + manifests.length);
console.log("DISPOSITIONS: " + JSON.stringify(counts));
console.log("DUPLICATE_OLDPATHS: " + dup);
if (dup > 0) { console.error("FATAL: duplicate oldPath entries present"); process.exit(1); }
