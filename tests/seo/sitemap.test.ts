jest.mock("@/lib/blog/queries", () => ({
  fetchAllPostSlugs: jest.fn().mockResolvedValue(["what-is-my-birth-chart", "some-real-post"]),
}));

import sitemap from "@/app/sitemap";

describe("sitemap contract (B3)", () => {
  const originalIndexedCombos = process.env.CSG_INDEXED_PROGRAMMATIC_COMBOS;

  beforeEach(() => {
    delete process.env.CSG_INDEXED_PROGRAMMATIC_COMBOS;
  });

  afterAll(() => {
    if (originalIndexedCombos === undefined) {
      delete process.env.CSG_INDEXED_PROGRAMMATIC_COMBOS;
    } else {
      process.env.CSG_INDEXED_PROGRAMMATIC_COMBOS = originalIndexedCombos;
    }
  });

  it("produces deduplicated, canonical URLs with no lastmod fabrication", async () => {
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    const unique = new Set(urls);
    expect(urls.length).toBe(unique.size); // no duplicates
    // No fabricated freshness
    for (const e of entries) {
      expect((e as any).lastModified).toBeUndefined();
    }
    // Honest, launch-ready trust/commercial pages ARE present (indexable).
    expect(urls).toContain("https://cosmicspiritguide.com/contact");
    expect(urls).toContain("https://cosmicspiritguide.com/privacy");
    expect(urls).toContain("https://cosmicspiritguide.com/terms");
    expect(urls).toContain("https://cosmicspiritguide.com/pricing");
    expect(urls).toContain("https://cosmicspiritguide.com/services");
    // programmatic token-swap combos must be absent (live-but-NOINDEX until curated)
    expect(urls).not.toContain("https://cosmicspiritguide.com/astrology/aries/taurus");
    expect(urls).not.toContain("https://cosmicspiritguide.com/compatibility/aries-and-libra");
    // Programmatic pages stay out until their exact key is approved.
    expect(urls).not.toContain("https://cosmicspiritguide.com/zodiac/aries");
    expect(urls).toContain("https://cosmicspiritguide.com/tarot");
    expect(urls).toContain("https://cosmicspiritguide.com/blog/what-is-my-birth-chart");
  });

  it("includes exactly one of each canonical and no unapproved zodiac pages", async () => {
    const entries = await sitemap();
    // every URL absolute + https + prod host
    for (const e of entries) {
      expect(e.url.startsWith("https://cosmicspiritguide.com")).toBe(true);
    }
    const zodiac = entries.filter((e) => e.url.includes("/zodiac/"));
    expect(zodiac).toHaveLength(0);
  });

  it("includes only the exact zodiac pages approved for indexing", async () => {
    process.env.CSG_INDEXED_PROGRAMMATIC_COMBOS = "zodiac:leo";
    const entries = await sitemap();
    const zodiac = entries.filter((e) => e.url.includes("/zodiac/")).map((e) => e.url);
    expect(zodiac).toEqual(["https://cosmicspiritguide.com/zodiac/leo"]);
    expect(new Set(entries.map((e) => e.url)).size).toBe(entries.length);
  });
});
