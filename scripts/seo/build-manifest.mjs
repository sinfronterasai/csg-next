// Deterministic mirror generator. Reads the audit CSV and emits docs/seo/legacy-url-migration-manifest.json.
// Disposition logic is centralized here (the integration owner's canonical IA).
// Portable: CSV resolved relative to THIS script (committed at docs/seo/evidence/route-parity-audit.csv).
// Missing input fails the process with a nonzero exit code.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "node:url";
import { BLOG_OVERRIDES, loadSanitySlugs, decideBlog } from "./blog-dispositions.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const CSV = path.join(SCRIPT_DIR, "..", "..", "docs", "seo", "evidence", "route-parity-audit.csv");
const OUT = path.join(SCRIPT_DIR, "..", "..", "docs", "seo", "legacy-url-migration-manifest.json");
const PROD = "https://cosmicspiritguide.com";

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

  if (fam === "/astrology") {
    // Hub is a real navigational route; stays indexable.
    if (p === "/astrology") {
      return mk("KEEP_AND_REBUILD", p, 200, true, PROD + p, null,
        "Astrology hub; indexable navigational route.");
    }
    // 144 Sun/Moon combos: route stays LIVE (200) with real pair-specific
    // interpretation, but NOINDEX by default until spot-reviewed for the
    // uniqueness/depth bar (John 2026-08-30 reconciliation: routes live,
    // index flag earned per page).
    return mk("KEEP_AND_REBUILD", p, 200, false, PROD + p, null,
      "Sun/Moon combo: live with deterministic pair-specific content; NOINDEX until spot-reviewed for uniqueness/depth bar.");
  }
  if (fam === "/zodiac") {
    return mk("KEEP_AND_REBUILD", p, 200, true, PROD + p, null,
      "Zodiac sign page (SELECTIVE REFRESH): curated, distinct per sign; indexable.");
  }
  if (fam === "/compatibility") {
    // Hub is a real navigational route; stays indexable.
    if (p === "/compatibility") {
      return mk("KEEP_AND_REBUILD", p, 200, true, PROD + p, null,
        "Compatibility hub; indexable navigational route.");
    }
    const slug = p.replace("/compatibility/", "");
    const parts = slug.split("-and-");
    if (parts.length === 2) {
      const [a, b] = parts.sort();
      const can = "/compatibility/" + a + "-and-" + b;
      if (can !== p) {
        return mk("MERGE_AND_301", can, 301, false, PROD + can, PROD + can,
          "Non-canonical ordering; 301 to alphabetical canonical pair (internal same-family dedupe).");
      }
      // Canonical pair page: route stays LIVE (200) with real pair-specific
      // interpretation, NOINDEX until spot-reviewed for the uniqueness/depth bar.
      return mk("KEEP_AND_REBUILD", p, 200, false, PROD + p, null,
        "Canonical love-pair: live with deterministic pair-specific content; NOINDEX until spot-reviewed for uniqueness/depth bar.");
    }
    return mk("KEEP_AND_REBUILD", p, 200, true, PROD + p, null, "Compatibility hub; indexable.");
  }
  if (fam === "/transits") {
    return mk("RETIRE_410", null, 410, false, null, "410",
      "Static generic transit prose with no real computed ephemeris data; retire until a real transit engine exists.");
  }
  if (fam === "/horoscope") {
    return mk("RETIRE_410", null, 410, false, null, "410",
      "All 13 share one title/description with no real dated data; do-not-fabricate-daily; retire until a genuine source exists.");
  }

  if (fam === "/blog") return decideBlog(r, sanitySlugs, PROD);

  if (fam === "/tarot") {
    return mk("KEEP_AND_REBUILD", p, 200, true, PROD + p, null,
      "Tarot card page already generated from deck data; ensure canonical + schema.");
  }

  if (p === "/") return mk("KEEP_AND_REBUILD", "/", 200, true, PROD + "/", null,
    "Homepage/entity. Rebuild copy around authorized launch products only; Organization/WebSite JSON-LD.");
  if (["/about","/contact","/privacy","/terms"].includes(p))
    return mk("KEEP_AND_REBUILD", p, 200, true, PROD + p, null,
      "Trust/legal/entity page requiring real authored content (no fabricated legal assurances).");
  if (["/birth-chart","/constellations"].includes(p))
    return mk("REFRESH_AND_MIGRATE", p, 200, true, PROD + p, null,
      "Resolves on new build; migrate real metadata, fix generic title/canonical/JSON-LD.");

  if (["/login","/reset-password","/profile","/my-chart","/reports"].includes(p))
    return mk("NOINDEX_UTILITY", p, 200, false, PROD + p, null,
      "Account/utility route; reachable but excluded from sitemap and noindex.");
  if (p === "/dashboard")
    return mk("MERGE_AND_301", "/login", 301, false, PROD + "/login", PROD + "/login",
      "Legacy gated redirect to /login; collapse to canonical account entry.");

  // Unlaunched commercial products: intentional 410 (no equivalent launch route on new build).
  // Per review B7, an unrelated homepage redirect is prohibited; retire clearly instead.
  if (["/pricing","/credits","/services","/subscription"].includes(p)) {
    return mk("RETIRE_410", null, 410, false, null, "410",
      "Advertises unlaunched products with no equivalent launch route on the new build; intentional 410 until an authorized commercial hub exists.");
  }

  if (["/coach","/forecasts","/journal","/newsletter","/energy","/moon-reading","/moon-phase"].includes(p))
    return mk("RETIRE_410", null, 410, false, null, "410",
      "Unlaunched, duplicate, or dead route with no defensible launch intent; intentional 410.");

  if (newStatus === "200")
    return mk("KEEP_AND_REBUILD", p, 200, true, PROD + p, null, "Resolves on new build; review.");
  return mk("RETIRE_410", null, 410, false, null, "410", "No healthy legacy and no launch intent; retire.");

  function mk(disposition, newPath, intendedStatus, indexable, canonicalUrl, redirectTarget, reason) {
    return { disposition, newPath, intendedStatus, indexable, canonicalUrl, redirectTarget, reason };
  }
}

const sanitySlugs = loadSanitySlugs();
const manifests = [];
for (const r of rows) {
  const p = r[0];
  const d = decide(r, sanitySlugs);
  manifests.push({
    oldPath: p,
    oldStatus: r[2],
    routeFamily: familyOf(p),
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
for (const m of manifests) {
  if (seen.has(m.oldPath)) dup++;
  seen.add(m.oldPath);
}

fs.writeFileSync(OUT, JSON.stringify(manifests, null, 2) + "\n");

// Emit the edge-safe redirect map (used by middleware) from the SAME dispositions,
// so the map can never diverge from the manifest. Only redirecting dispositions are emitted.
const REDIRECT_OUT = path.join(SCRIPT_DIR, "..", "..", "src", "lib", "seo", "redirect-map.ts");
const mapEntries = [];
for (const m of manifests) {
  if (m.disposition === "MERGE_AND_301" || m.disposition === "301_EQUIVALENT") {
    if (m.redirectTarget && m.redirectTarget !== "410") {
      mapEntries.push('  ' + JSON.stringify(m.oldPath) + ': { status: 301, target: ' + JSON.stringify(m.redirectTarget) + ' },');
    }
  } else if (m.disposition === "RETIRE_410") {
    mapEntries.push('  ' + JSON.stringify(m.oldPath) + ': { status: 410, target: null },');
  }
}
const mapSrc =
  '// AUTO-GENERATED from docs/seo/legacy-url-migration-manifest.json by scripts/seo/build-manifest.mjs.\n' +
  '// Edge-safe redirect map (no fs/node). Used by middleware.\n' +
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
