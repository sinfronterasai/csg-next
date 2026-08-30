// Deterministic mirror generator. Reads the audit CSV and emits docs/seo/legacy-url-migration-manifest.json.
// Disposition logic is centralized here (the integration owner's canonical IA).
import fs from "fs";
import path from "path";
import { BLOG_OVERRIDES, loadSanitySlugs, decideBlog } from "./blog-dispositions.mjs";

const CSV = "/workspace/csg-report-handoff/content-route-parity-audit-2026-08-30.csv";
const OUT = "docs/seo/legacy-url-migration-manifest.json";
const PROD = "https://cosmicspiritguide.com";

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

const SIGNS = ["aries","taurus","gemini","cancer","leo","virgo","libra","scorpio","sagittarius","capricorn","aquarius","pisces"];

// Canonical commercial hub for merged unlaunched-product pages.
const HUB = "/";

function familyOf(path) {
  const seg = path.split("/")[1] || "";
  return "/" + seg;
}

// Returns { disposition, newPath, intendedStatus, indexable, canonicalUrl, redirectTarget, reason, reviewState }
function decide(r, sanitySlugs) {
  const path = r[0];
  const family = r[1];
  const oldStatus = r[2];
  const newStatus = r[3];
  const fam = familyOf(path);

  // --- Programmatic families ---
  if (fam === "/astrology") {
    // Natal Sun+Moon combos: distinct intent. Rebuild from deterministic SIGNS data.
    return mk("KEEP_AND_REBUILD", path, 200, true, PROD + path, null,
      "Distinct natal Sun+Moon combo with deterministic sign-derived content (element/modality/ruler/traits); unique self-understanding intent, not a token swap of compatibility.");
  }
  if (fam === "/zodiac") {
    return mk("KEEP_AND_REBUILD", path, 200, true, PROD + path, null,
      "Distinct sign hub/page with deterministic traits from SIGNS data; unique informational intent.");
  }
  if (fam === "/compatibility") {
    // canonical pair format: /compatibility/<a>-and-<b> with a <= b alphabetically.
    const slug = path.replace("/compatibility/", "");
    const parts = slug.split("-and-");
    if (parts.length === 2) {
      const [a, b] = parts.sort();
      const can = "/compatibility/" + a + "-and-" + b;
      if (can !== path) {
        return mk("MERGE_AND_301", can, 301, false, PROD + can, PROD + can,
          "Non-canonical ordering; 301 to alphabetical canonical pair.");
      }
      return mk("KEEP_AND_REBUILD", path, 200, true, PROD + path, null,
        "Canonical unordered love-pair page; deterministic compatibility from SIGNS element/modality dynamics.");
    }
    return mk("KEEP_AND_REBUILD", path, 200, true, PROD + path, null,
      "Compatibility hub; indexable.");
  }
  if (fam === "/transits") {
    return mk("RETIRE_410", null, 410, false, null, "410",
      "Static generic transit prose with no real computed ephemeris data; transit engine not served as dated public pages. Retire until a real transit engine page exists. (src/lib/transit.ts is the future source.)");
  }
  if (fam === "/horoscope") {
    return mk("RETIRE_410", null, 410, false, null, "410",
      "All 13 share one title/description with no real dated data; do-not-fabricate-daily. Retire until a genuine dated horoscope source exists.");
  }

  if (fam === "/blog") return decideBlog(r, sanitySlugs, PROD);

  // --- Tarot cards: keep (already built from deck) ---
  if (fam === "/tarot") {
    return mk("KEEP_AND_REBUILD", path, 200, true, PROD + path, null,
      "Tarot card page already generated from deck data; ensure canonical + schema.");
  }

  // --- Trust / legal / entity / utility (W3) ---
  if (path === "/") return mk("KEEP_AND_REBUILD", "/", 200, true, PROD + "/", null,
    "Homepage/entity. Rebuild copy around authorized launch products only; Organization/WebSite JSON-LD.");
  if (["/about","/contact","/privacy","/terms"].includes(path))
    return mk("KEEP_AND_REBUILD", path, 200, true, PROD + path, null,
      "Trust/legal/entity page requiring real authored content (no fabricated legal assurances).");
  if (["/birth-chart","/constellations"].includes(path))
    return mk("REFRESH_AND_MIGRATE", path, 200, true, PROD + path, null,
      "Resolves on new build; migrate real metadata, fix generic title/canonical/JSON-LD.");

  // Account / utility -> NOINDEX
  if (["/login","/reset-password","/profile","/my-chart","/reports"].includes(path))
    return mk("NOINDEX_UTILITY", path, 200, false, PROD + path, null,
      "Account/utility route; reachable but excluded from sitemap and noindex.");
  if (path === "/dashboard")
    return mk("MERGE_AND_301", "/login", 301, false, PROD + "/login", PROD + "/login",
      "Legacy gated redirect to /login; collapse to canonical account entry.");

  // Unlaunched commercial -> MERGE to hub (authorized launch products only live on /).
  // /dashboard is a real account route, so it 301s to /login instead.
  if (["/pricing","/credits","/services","/subscription"].includes(path)) {
    return mk("MERGE_AND_301", HUB, 301, false, PROD + HUB, PROD + HUB,
      "Advertises unlaunched products; 301 to canonical commercial hub (authorized products only).");
  }

  // Clear retire: unlaunched/duplicate/dead
  if (["/coach","/forecasts","/journal","/newsletter","/energy","/moon-reading","/moon-phase"].includes(path))
    return mk("RETIRE_410", null, 410, false, null, "410",
      "Unlaunched, duplicate, or dead route with no defensible launch intent; intentional 410.");

  // Default: keep synced if resolves, else investigate
  if (newStatus === "200")
    return mk("KEEP_AND_REBUILD", path, 200, true, PROD + path, null, "Resolves on new build; review.");
  return mk("RETIRE_410", null, 410, false, null, "410", "No healthy legacy and no launch intent; retire.");

  function mk(disposition, newPath, intendedStatus, indexable, canonicalUrl, redirectTarget, reason) {
    return { disposition, newPath, intendedStatus, indexable, canonicalUrl, redirectTarget, reason };
  }
}

const sanitySlugs = loadSanitySlugs();
const manifests = [];
for (const r of rows) {
  const path = r[0];
  const d = decide(r, sanitySlugs);
  manifests.push({
    oldPath: path,
    oldStatus: r[2],
    routeFamily: familyOf(path),
    newPath: d.newPath,
    intendedStatus: d.intendedStatus,
    indexable: d.indexable,
    canonicalUrl: d.canonicalUrl,
    disposition: d.disposition,
    reason: d.reason,
    primaryIntent: d.disposition === "RETIRE_410" ? "n/a" : "see rationale",
    uniqueValue: d.disposition === "RETIRE_410" ? "none" : "deterministic sign/route data",
    sourceOrDataset: path.startsWith("/blog") ? "sanity:blogPost" : "deterministic:src/lib/astrology",
    redirectTarget: d.redirectTarget,
    metadataKey: path,
    schemaTypes: d.indexable ? "WebSite,BreadcrumbList" : "",
    reviewState: d.disposition === "KEEP_AND_REBUILD" ? "needs-acceptance" : "decided",
    owner: "pike",
  });
}

// Emit edge-safe redirect map for middleware (no fs/node at runtime).
const REDIR = manifests
  .filter((m) => m.disposition === "RETIRE_410" || ((m.disposition === "MERGE_AND_301" || m.disposition === "301_EQUIVALENT") && m.redirectTarget && m.redirectTarget !== "410"))
  .map((m) => {
    const key = (m.oldPath || "/").replace(/\/$/, "") || "/";
    if (m.disposition === "RETIRE_410") {
      return '  ' + JSON.stringify(key) + ': { status: 410, target: null },';
    }
    return '  ' + JSON.stringify(key) + ': { status: 301, target: ' + JSON.stringify(m.redirectTarget) + ' },';
  });
const mapOut = [
  '// AUTO-GENERATED from docs/seo/legacy-url-migration-manifest.json by scripts/seo/build-manifest.mjs.',
  '// Edge-safe redirect map (no fs/node). Used by middleware.',
  'export interface EdgeRedirect { status: 301 | 410; target: string | null; }',
  'export const REDIRECT_MAP: Record<string, EdgeRedirect> = {',
  ...REDIR,
  '};',
  '',
].join("\n");
fs.writeFileSync("src/lib/seo/redirect-map.ts", mapOut);

fs.mkdirSync("docs/seo", { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(manifests, null, 2));
console.log("WROTE", OUT, "rows:", manifests.length);
const counts = {};
for (const m of manifests) counts[m.disposition] = (counts[m.disposition] || 0) + 1;
console.log("DISPOSITIONS:", JSON.stringify(counts));
// sanity: every oldPath unique
const seen = {};
let dup = 0;
for (const m of manifests) { if (seen[m.oldPath]) dup++; seen[m.oldPath] = 1; }
console.log("DUPLICATE_OLDPATHS:", dup);
