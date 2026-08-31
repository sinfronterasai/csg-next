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

  test("retired transits/horoscope resolve to 410", () => {
    const d1 = resolveLegacyRedirect("/transits/2026-08-30");
    expect(d1).not.toBeNull();
    expect(d1!.status).toBe(410);
    const d2 = resolveLegacyRedirect("/horoscope/aries");
    expect(d2!.status).toBe(410);
  });

  test("unlaunched commercial routes are retired (410), not redirected to hub (B7)", () => {
    const d = resolveLegacyRedirect("/pricing");
    expect(d).not.toBeNull();
    expect(d!.status).toBe(410);
    const d2 = resolveLegacyRedirect("/credits");
    expect(d2!.status).toBe(410);
  });

  test("no catch-all to / for unknown paths", () => {
    // an unknown legacy path not in manifest must NOT be force-routed to /
    const d = resolveLegacyRedirect("/some-never-existed-path");
    expect(d).toBeNull();
  });
});
