import fs from "fs";
import path from "path";
import { zodiacData, compatibilityData, astrologyData, allSignKeys } from "@/lib/seo/programmatic";
import { loadManifest } from "@/lib/seo/redirects";

const SANITY = path.join(__dirname, "..", "..", "scripts", "seo", "sanity-slugs.txt");
function sanitySlugs(): Set<string> {
  const raw = fs.readFileSync(SANITY, "utf8");
  return new Set(raw.split("\n").map((s) => s.trim()).filter(Boolean));
}

describe("acceptance: indexable pages have unique canonicals (#4)", () => {
  test("no two real indexable pages share a canonical", () => {
    const rows = loadManifest().filter(
      (r) => (r.disposition === "KEEP_AND_REBUILD" || r.disposition === "REFRESH_AND_MIGRATE") && r.canonicalUrl,
    );
    const seen = new Set<string>();
    for (const r of rows) {
      expect(seen.has(r.canonicalUrl!)).toBe(false);
      seen.add(r.canonicalUrl!);
      expect(r.canonicalUrl).toMatch(/^https:\/\/cosmicspiritguide\.com\//);
    }
    expect(rows.length).toBeGreaterThan(50);
  });
});

describe("acceptance: invalid programmatic params 404 (#11)", () => {
  test("bogus sign yields no data (dynamicParams=false -> notFound)", () => {
    expect(zodiacData("pluto")).toBeNull();
    expect(compatibilityData("pluto", "aries")).toBeNull();
    expect(astrologyData("pluto", "aries")).toBeNull();
    expect(astrologyData("aries", "pluto")).toBeNull();
  });
  test("all 12 valid signs resolve", () => {
    for (const k of allSignKeys()) expect(zodiacData(k)).not.toBeNull();
  });
});

describe("acceptance: programmatic thinness / no token-swap (#13)", () => {
  test("each astrology combo carries a unique pair of real explanations", () => {
    const keys = allSignKeys();
    const bodies = new Set<string>();
    for (const s of keys) {
      for (const m of keys) {
        const d = astrologyData(s, m)!;
        const body = d.sun.explanation + " | " + d.moon.explanation + " | " + d.sun.ruler + "/" + d.moon.ruler;
        bodies.add(body);
        expect(d.sun.explanation.length).toBeGreaterThan(60);
        expect(d.moon.explanation.length).toBeGreaterThan(60);
      }
    }
    expect(bodies.size).toBe(144);
  });
  test("compatibility pages differ by element/modality mix", () => {
    const a = compatibilityData("aries", "taurus")!;
    const b = compatibilityData("taurus", "aries")!;
    expect(a.canonical).toBe(b.canonical);
    expect(a.elementMix).toBe("Fire + Earth");
  });
});

describe("acceptance: blog sitemap matches Sanity source (#18)", () => {
  test("blog rows are not indexable until approval (C6): HOLD_NOINDEX / RETIRE_410 / same-intent MERGE_AND_301", () => {
    const slugs = sanitySlugs();
    expect(slugs.size).toBeGreaterThan(5);
    const blogRows = loadManifest().filter((r) => r.routeFamily === "/blog" && r.oldPath !== "/blog");
    expect(blogRows.length).toBeGreaterThan(0);
    for (const r of blogRows) {
      // No blog slug is published/indexable until CMS approval evidence exists.
      // Slop variants 301 to the /blog hub (same-intent, not indexable) — still held.
      expect(r.disposition === "HOLD_NOINDEX" || r.disposition === "RETIRE_410" || r.disposition === "MERGE_AND_301").toBe(true);
      expect(r.indexable).toBe(false);
    }
  });
  test("no blog row claims REFRESH without a Sanity source", () => {
    const slugs = sanitySlugs();
    for (const r of loadManifest()) {
      if (r.routeFamily !== "/blog") continue;
      if (r.disposition === "REFRESH_AND_MIGRATE") {
        const slug = r.oldPath.replace("/blog/", "");
        expect(slugs.has(slug)).toBe(true);
      }
    }
  });
});

describe("acceptance: manifest/sitemap target agreement (#17)", () => {
  test("C5: no 301_EQUIVALENT rows remain (editorial queue not redirected to tools/held targets)", () => {
    const rows = loadManifest();
    expect(rows.filter((r) => r.disposition === "301_EQUIVALENT").length).toBe(0);
  });
  test("remaining 301 targets resolve to a known 200 route or kept slug", () => {
    const rows = loadManifest();
    const keptPaths = new Set(rows.filter((r) => r.indexable).map((r) => r.oldPath));
    const allowed = [
      "/tarot", "/compatibility", "/birth-chart", "/login", "/",
      "/blog", "/transits", "/zodiac", "/horoscope", "/astrology",
    ];
    for (const r of rows) {
      if (r.disposition === "MERGE_AND_301" && r.redirectTarget) {
        const tgt = r.redirectTarget.replace(/^https?:\/\/[^/]+/, "");
        expect(allowed.includes(tgt) || keptPaths.has(tgt)).toBe(true);
      }
    }
  });
});
