import { transformPost, transformList } from "@/lib/blog/transform";
import { sanityImageUrl } from "@/lib/sanity/image";

const FEAT_REF = "image-5dfca6192680dc091a03f1d7ecb8e7e004fcda1f-1024x1024-webp";
const INLINE_REF = "image-9b1e5143bdad77ed0e327d237662031c45435784-1024x1024-webp";

const rawPost = {
  _id: "lions-gate",
  title: "Lions Gate Portal",
  slug: { current: "lions-gate-portal" },
  excerpt: "A guide.",
  author: "Cosmic Spirit Guide",
  publishedAt: "2026-08-09T05:32:29.764Z",
  readingTime: 15,
  wordCount: 2833,
  status: "published",
  category: "Astrology",
  featuredImage: { _type: "image", alt: "", asset: { _ref: FEAT_REF } },
  content: [
    { _key: "h", _type: "block", style: "h2", children: [{ _key: "c", text: "What is it?", marks: [] }] },
    { _key: "b", _type: "block", style: "normal", children: [{ _key: "c2", text: "Bold", marks: ["strong"] }] },
    { _key: "img1", _type: "image", alt: "", asset: { _ref: INLINE_REF } },
  ],
  faqSection: [
    { question: "Q1?", answer: "A1" },
    { question: "", answer: "" }, // should be filtered
  ],
  seoTitle: "Lions Gate SEO",
  metaDescription: "meta desc",
  canonicalUrl: "https://x.com/lions",
  robots: "index, follow",
  ogTitle: "OG",
  ogDescription: "og desc",
  ogImage: "https://x.com/og.png",
  ogType: "article",
  ogUrl: "https://x.com/lions",
  ogSiteName: "Cosmic Spirit Guide",
  twitterCard: "summary_large_image",
  twitterTitle: "TW",
  twitterDescription: "tw desc",
  twitterImage: "https://x.com/tw.png",
  twitterSite: "@cosmicspirit",
};

describe("transformPost", () => {
  const post = transformPost(rawPost, "https://cosmicspiritguide.com");

  it("resolves featured image with non-empty alt (backfilled from title)", () => {
    expect(post.featuredImage.url).toContain("cdn.sanity.io");
    expect(post.featuredImage.alt).toBe("Lions Gate Portal — Cosmic Spirit Guide");
  });

  it("normalizes inline image with resolvable url + alt", () => {
    const imgBlock = (post.content as any[]).find((b) => b._type === "image");
    expect(imgBlock._resolved.url).toContain("cdn.sanity.io");
    expect(imgBlock._resolved.alt).toBe("Lions Gate Portal — Cosmic Spirit Guide");
  });

  it("filters out empty faq items", () => {
    expect(post.faqSection).toHaveLength(1);
    expect(post.faqSection[0]).toEqual({ question: "Q1?", answer: "A1" });
  });

  it("derives seo fields with sensible fallbacks", () => {
    expect(post.seo.seoTitle).toBe("Lions Gate SEO");
    expect(post.seo.canonicalUrl).toBe("https://x.com/lions");
    expect(post.seo.robots).toBe("index, follow");
  });

  it("backfills canonical when missing", () => {
    const p2 = transformPost({ ...rawPost, canonicalUrl: null }, "https://base.com");
    expect(p2.seo.canonicalUrl).toBe("https://base.com/blog/lions-gate-portal");
  });
});

describe("transformList", () => {
  it("maps list items and backfills image alt", () => {
    const list = transformList([rawPost]);
    expect(list).toHaveLength(1);
    expect(list[0].slug).toBe("lions-gate-portal");
    expect(list[0].featuredImage.alt).toContain("Lions Gate Portal");
    expect(list[0].featuredImage.url).toContain("cdn.sanity.io");
  });
});
