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
  "/dashboard",
  "/journal",
  "/profile",
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
  // Canonical blog bases (301 targets for slop consolidation, confirmed in John's map)
  "/blog/free-moon-sign-calculator-discover-your-emotional-core",
  "/blog/free-zodiac-compatibility-calculator-find-your-cosmic-match",
  "/blog/how-to-read-your-birth-chart-a-beginner-s-visual-guide",
  "/blog/love-compatibility-by-birth-date-the-complete-guide",
  "/blog/mercury-retrograde-meaning-complete-survival-guide",
  "/blog/numerology-compatibility-calculator-life-path-numbers",
  "/blog/rising-sign-calculator-find-your-ascendant-sign-free",
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

  test("app singletons 301 to same-intent hub per John's map (no 410, no homepage)", () => {
    expect(resolveLegacyRedirect("/credits")!.status).toBe(301);
    expect(resolveLegacyRedirect("/credits")!.target).toBe("https://cosmicspiritguide.com/pricing");
    expect(resolveLegacyRedirect("/subscription")!.target).toBe("https://cosmicspiritguide.com/pricing");
    expect(resolveLegacyRedirect("/coach")!.target).toBe("https://cosmicspiritguide.com/services");
    expect(resolveLegacyRedirect("/energy")!.target).toBe("https://cosmicspiritguide.com/transits");
    expect(resolveLegacyRedirect("/forecasts")!.target).toBe("https://cosmicspiritguide.com/transits");
    expect(resolveLegacyRedirect("/moon-phase")!.target).toBe("https://cosmicspiritguide.com/transits");
    expect(resolveLegacyRedirect("/moon-reading")!.target).toBe("https://cosmicspiritguide.com/birth-chart");
    expect(resolveLegacyRedirect("/newsletter")!.target).toBe("https://cosmicspiritguide.com/blog");
    expect(resolveLegacyRedirect("/profile")!.target).toBe("https://cosmicspiritguide.com/dashboard");
    expect(resolveLegacyRedirect("/")).toBeNull();
  });

  test("no catch-all to / for unknown paths", () => {
    const d = resolveLegacyRedirect("/some-never-existed-path");
    expect(d).toBeNull();
  });
});
