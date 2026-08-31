jest.mock("@/lib/blog/queries", () => ({
  fetchAllPostSlugs: jest.fn().mockResolvedValue(["what-is-my-birth-chart", "some-real-post"]),
}));

import sitemap from "@/app/sitemap";
import { allSignKeys } from "@/lib/seo/programmatic";

describe("sitemap contract (B3)", () => {
  it("produces deduplicated, canonical URLs with no lastmod fabrication", async () => {
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    const unique = new Set(urls);
    expect(urls.length).toBe(unique.size); // no duplicates
    // No fabricated freshness
    for (const e of entries) {
      expect((e as any).lastModified).toBeUndefined();
    }
    // noindex/legal/trust pages must be absent
    expect(urls).not.toContain("https://cosmicspiritguide.com/contact");
    expect(urls).not.toContain("https://cosmicspiritguide.com/privacy");
    expect(urls).not.toContain("https://cosmicspiritguide.com/terms");
    // programmatic token-swap combos must be absent
    expect(urls).not.toContain("https://cosmicspiritguide.com/astrology/aries/taurus");
    expect(urls).not.toContain("https://cosmicspiritguide.com/compatibility/aries-and-libra");
    // curated families present
    expect(urls).toContain("https://cosmicspiritguide.com/zodiac/aries");
    expect(urls).toContain("https://cosmicspiritguide.com/tarot");
    expect(urls).toContain("https://cosmicspiritguide.com/blog/what-is-my-birth-chart");
  });

  it("includes exactly one of each canonical and the indexable hub set only", async () => {
    const entries = await sitemap();
    const urlSet = new Set(entries.map((e) => e.url.replace(/\/$/, "") || e.url));
    // every URL absolute + https + prod host
    for (const e of entries) {
      expect(e.url.startsWith("https://cosmicspiritguide.com")).toBe(true);
    }
    // zodiac count matches sign count (curated, distinct)
    const zodiac = entries.filter((e) => e.url.includes("/zodiac/"));
    expect(zodiac.length).toBe(allSignKeys().length);
  });
});
