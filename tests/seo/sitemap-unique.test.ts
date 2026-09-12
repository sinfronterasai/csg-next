/**
 * Regression: the final sitemap must contain no duplicate <loc> entries.
 *
 * Live defect reproduced on csg-pr-15.onrender.com/sitemap.xml: 400 rows but only
 * 399 unique URLs. The known duplicate was
 *   https://cosmicspiritguide.com/blog/the-future-of-fate-how-ai-powered-tarot-readings-work
 * appearing twice (the source slug list itself contained the slug twice).
 *
 * The uniqueness guarantee must hold even when the blog slug source returns a
 * duplicated slug, so this test mocks fetchAllPostSlugs to include the duplicate.
 */
jest.mock("@/lib/blog/queries", () => ({
  fetchAllPostSlugs: jest.fn().mockResolvedValue([
    "what-is-my-birth-chart",
    "the-future-of-fate-how-ai-powered-tarot-readings-work",
    // Duplicated in the source list; must still appear exactly once in output.
    "the-future-of-fate-how-ai-powered-tarot-readings-work",
  ]),
}));

import sitemap from "@/app/sitemap";

describe("sitemap uniqueness regression (migration defect)", () => {
  it("never emits a duplicate URL even if the blog source repeats a slug", async () => {
    const entries = await sitemap();
    const urls = entries.map((e) => e.url.replace(/\/$/, "") || e.url);
    const unique = new Set(urls);
    expect(urls.length).toBe(unique.size);
  });

  it("the previously-duplicated blog URL appears exactly once", async () => {
    const entries = await sitemap();
    const target =
      "https://cosmicspiritguide.com/blog/the-future-of-fate-how-ai-powered-tarot-readings-work";
    const count = entries.filter(
      (e) => (e.url.replace(/\/$/, "") || e.url) === target,
    ).length;
    expect(count).toBe(1);
  });
});
