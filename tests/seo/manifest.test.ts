import { loadManifest, resolveLegacyRedirect, validateManifest } from "@/lib/seo/redirects";

const KNOWN_ROUTES = [
  "/",
  "/about",
  "/contact",
  "/privacy",
  "/terms",
  "/birth-chart",
  "/constellations",
  "/blog",
  "/tarot",
  "/login",
  "/reset-password",
  "/profile",
  "/my-chart",
  "/reports",
  "/compatibility",
  "/compatibility/aries-and-taurus",
  "/zodiac",
  "/zodiac/aries",
  "/astrology/aries/taurus",
  "/horoscope",
  "/horoscope/aries",
  "/transits",
  "/transits/2026-08-30",
  "/pricing",
  "/services",
  // Canonical blog bases (301 targets for slop consolidation, confirmed live in Sanity prod)
  "/blog/free-moon-sign-calculator-discover-your-emotional-core",
  "/blog/free-zodiac-compatibility-calculator-find-your-cosmic-match",
  "/blog/how-to-read-your-birth-chart-a-beginner-s-visual-guide",
  "/blog/love-compatibility-by-birth-date-the-complete-guide",
  "/blog/mercury-retrograde-meaning-complete-survival-guide",
  "/blog/numerology-compatibility-calculator-life-path-numbers",
  "/blog/twin-flame-compatibility-test-are-they-your-other-half",
];

describe("legacy migration manifest", () => {
  test("every legacy path has exactly one row (acceptance #1)", () => {
    const rows = loadManifest();
    const seen = new Set<string>();
    for (const r of rows) {
      expect(seen.has(r.oldPath)).toBe(false);
      seen.add(r.oldPath);
    }
    expect(rows.length).toBeGreaterThan(400);
  });

  test("no redirect chain/loop; 301 targets are 200 routes; 410 has no target (acceptance #3)", () => {
    const errors = validateManifest(KNOWN_ROUTES);
    expect(errors).toEqual([]);
  });

  test("live programmatic grids are NOT redirected (routes kept, index flag earned per page)", () => {
    expect(resolveLegacyRedirect("/astrology/aries/taurus")).toBeNull();
    expect(resolveLegacyRedirect("/compatibility/aries-and-libra")).toBeNull();
    expect(resolveLegacyRedirect("/zodiac/aries")).toBeNull();
    expect(resolveLegacyRedirect("/horoscope/aries")).toBeNull();
    expect(resolveLegacyRedirect("/transits/2026-08-30")).toBeNull();
  });

  test("unlaunched commercial routes are retired (410); live commercial hubs are NOT redirected (B7)", () => {
    const d2 = resolveLegacyRedirect("/credits");
    expect(d2!.status).toBe(410);
    const d3 = resolveLegacyRedirect("/subscription");
    expect(d3!.status).toBe(410);
    expect(resolveLegacyRedirect("/pricing")).toBeNull();
    expect(resolveLegacyRedirect("/services")).toBeNull();
  });

  test("no catch-all to / for unknown paths", () => {
    const d = resolveLegacyRedirect("/some-never-existed-path");
    expect(d).toBeNull();
  });
});
