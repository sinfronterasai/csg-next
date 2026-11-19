import {
  briefId,
  buildExcerpt,
  buildSanityDoc,
  existingIdsQuery,
  pickNextBrief,
  slugify,
  titleOf,
} from "@/lib/content/pipeline";
import { markdownToPortableText, countWords } from "@/lib/content/portable-text";
import { CONTENT_BRIEFS } from "@/lib/content/briefs";

const SAMPLE = [
  "## Why compatibility matters",
  "",
  "Astrology treats compatibility as a conversation between two charts.",
  "",
  "- Sun signs set the tone",
  "- Moons set the emotional weather",
  "",
  "> No placement is a verdict.",
  "",
  "### What to do next",
  "",
  "Compare your Moon and Venus placements.",
].join("\n");

describe("content pipeline: publication contract", () => {
  it("never emits a document that the public blog queries would render", () => {
    const doc = buildSanityDoc({ brief: CONTENT_BRIEFS[0], markdown: SAMPLE });

    // src/lib/blog/queries.ts requires BOTH of these before rendering.
    expect(doc.status).toBe("draft");
    expect(doc.review.status).toBe("pending");
    expect(doc.review.status).not.toBe("approved");
    expect(doc.status).not.toBe("published");
  });

  it("produces a document that satisfies the public query shape rules", () => {
    const doc = buildSanityDoc({ brief: CONTENT_BRIEFS[0], markdown: SAMPLE });

    expect(doc._type).toBe("blogPost");
    expect(doc.slug.current).toMatch(/^[a-z0-9-]+$/);
    expect(doc.slug.current.startsWith("__")).toBe(false);
    expect(doc.title.length).toBeGreaterThan(0);
    expect(doc.content.length).toBeGreaterThan(0);
    expect(Array.isArray(doc.review.hardFailFlags)).toBe(true);
    expect(doc.review.hardFailFlags).toHaveLength(0);
  });
});

describe("content pipeline: idempotency", () => {
  it("reports nothing to do once every brief already has a document", () => {
    const existing = CONTENT_BRIEFS.map((b) => briefId(titleOf(b)));
    expect(pickNextBrief(CONTENT_BRIEFS, existing)).toBeNull();
  });

  it("picks the first brief that has no document yet", () => {
    const taken = [briefId(titleOf(CONTENT_BRIEFS[0]))];
    expect(pickNextBrief(CONTENT_BRIEFS, taken)).toBe(CONTENT_BRIEFS[1]);
  });

  it("is restart-safe: the same existing set always yields the same brief", () => {
    const taken = [briefId(titleOf(CONTENT_BRIEFS[0])), briefId(titleOf(CONTENT_BRIEFS[1]))];
    const first = pickNextBrief(CONTENT_BRIEFS, taken);
    const second = pickNextBrief(CONTENT_BRIEFS, [...taken].reverse());
    expect(first).toBe(second);
    expect(first).toBe(CONTENT_BRIEFS[2]);
  });
});

describe("portable text conversion", () => {
  it("maps markdown structure onto Sanity block styles", () => {
    const blocks = markdownToPortableText(SAMPLE);
    const styles = blocks.map((b) => b.style);
    expect(styles).toContain("h2");
    expect(styles).toContain("h3");
    expect(styles).toContain("blockquote");
  });

  it("marks lists as list items and skips the H1", () => {
    const blocks = markdownToPortableText("# Title\n\n- one\n- two");
    expect(blocks[0].style).toBe("normal");
    expect((blocks[0] as { listItem?: string }).listItem).toBe("bullet");
    expect(blocks.some((b) => b.style === "h1")).toBe(false);
  });

  it("strips inline emphasis so no raw syntax reaches the reader", () => {
    const blocks = markdownToPortableText("A **bold** word");
    const text = blocks[0].children.map((c) => c.text).join("");
    expect(text).not.toContain("**");
    expect(text).toBe("A bold word");
  });

  it("gives every block and span a unique key", () => {
    const blocks = markdownToPortableText(SAMPLE);
    const keys = blocks.flatMap((b) => [b._key, ...b.children.map((c) => c._key)]);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("counts words", () => {
    expect(countWords("one two three")).toBe(3);
  });
});

describe("helpers", () => {
  it("slugifies titles to the allowed character set", () => {
    expect(slugify("Free Zodiac Compatibility Calculator: Find Your Cosmic Match")).toBe(
      "free-zodiac-compatibility-calculator-find-your-cosmic-match",
    );
    expect(slugify("  --Weird   Title!! -- ")).toBe("weird-title");
  });

  it("builds the doc id from the same slug the document carries", () => {
    const title = titleOf(CONTENT_BRIEFS[0]);
    const doc = buildSanityDoc({ brief: CONTENT_BRIEFS[0], markdown: SAMPLE });
    expect(doc._id).toBe(briefId(title));
    expect(doc._id).toBe(`blogPost.${doc.slug.current}`);
  });

  it("keeps excerpts plain and bounded", () => {
    const excerpt = buildExcerpt(SAMPLE, "fallback");
    expect(excerpt).not.toContain("#");
    expect(excerpt).not.toContain("**");
    expect(excerpt.length).toBeLessThanOrEqual(300);
    expect(excerpt.length).toBeGreaterThan(0);
  });

  it("asks Sanity only for ids and slugs", () => {
    expect(existingIdsQuery()).toContain('_type == "blogPost"');
  });
});
