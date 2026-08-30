// Manifest-driven redirects. Loads docs/seo/legacy-url-migration-manifest.json at module init.
// Only MERGE_AND_301 and RETIRE_410 entries produce routing decisions.
import fs from "fs";
import path from "path";

export type Disposition =
  | "KEEP_AND_REBUILD"
  | "REFRESH_AND_MIGRATE"
  | "MERGE_AND_301"
  | "301_EQUIVALENT"
  | "RETIRE_410"
  | "NOINDEX_UTILITY";

export interface ManifestRow {
  oldPath: string;
  newPath: string | null;
  intendedStatus: number;
  indexable: boolean;
  canonicalUrl: string | null;
  disposition: Disposition;
  reason: string;
  redirectTarget: string | null;
  [k: string]: unknown;
}

let cached: ManifestRow[] | null = null;

export function loadManifest(): ManifestRow[] {
  if (cached) return cached;
  const p = path.join(process.cwd(), "docs", "seo", "legacy-url-migration-manifest.json");
  const raw = fs.readFileSync(p, "utf8");
  cached = JSON.parse(raw) as ManifestRow[];
  return cached;
}

export interface RedirectDecision {
  status: 301 | 410;
  target: string | null;
}

export function resolveLegacyRedirect(oldPath: string): RedirectDecision | null {
  const rows = loadManifest();
  const norm = oldPath.split("?")[0].replace(/\/$/, "") || "/";
  for (const row of rows) {
    if (row.oldPath !== norm) continue;
    if (row.disposition === "MERGE_AND_301" || row.disposition === "301_EQUIVALENT") {
      if (row.redirectTarget) {
        if (row.redirectTarget !== "410") {
          return { status: 301, target: row.redirectTarget };
        }
      }
    }
    if (row.disposition === "RETIRE_410") {
      return { status: 410, target: null };
    }
    if (row.redirectTarget === "410") {
      return { status: 410, target: null };
    }
  }
  return null;
}

export function validateManifest(knownExistingPaths: string[]): string[] {
  const rows = loadManifest();
  const errors: string[] = [];
  const byPath = new Map<string, ManifestRow>();
  for (const r of rows) byPath.set(r.oldPath, r);

  if (byPath.size !== rows.length) errors.push("duplicate oldPath present");

  const existing = new Set(knownExistingPaths);
  for (const r of rows) {
    if (r.disposition === "MERGE_AND_301") {
      const tgt = r.redirectTarget;
      if (!tgt) {
        errors.push(r.oldPath + ": MERGE_AND_301 with no valid target");
        continue;
      }
      if (tgt === "410") {
        errors.push(r.oldPath + ": MERGE_AND_301 pointing at 410");
        continue;
      }
      const tgtNorm = tgt.replace(/^https?:\/\/[^/]+/, "").replace(/\/$/, "") || "/";
      const tgtRow = byPath.get(tgtNorm);
      if (!existing.has(tgtNorm)) {
        if (!tgtRow) {
          errors.push(r.oldPath + ": 301 target " + tgt + " unknown");
        } else if (tgtRow.intendedStatus !== 200) {
          errors.push(r.oldPath + ": 301 target " + tgt + " not a 200 route");
        }
      }
    }
    if (r.disposition === "RETIRE_410") {
      if (r.redirectTarget) {
        if (r.redirectTarget !== "410") {
          errors.push(r.oldPath + ": RETIRE_410 must not have a 301 target");
        }
      }
    }
  }
  return errors;
}
