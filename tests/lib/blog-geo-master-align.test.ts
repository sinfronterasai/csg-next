import { transformPost } from "@/lib/blog/transform";
import { buildBreadcrumbList } from "@/lib/blog/breadcrumb";

const base = {
  _id: "lg",
  title: "Lions Gate Portal",
  slug: { current: "lions-gate-portal" },
  excerpt: "A guide.",
  author: "Cosmic Spirit Guide",
  publishedAt: "2026-08-09T05:32:29.764Z",
  readingTime: 15,
  wordCount: 2833,
  status: "published",
  category: "Astrology",
  featuredImage: { _type: "image", alt: "", asset: { _ref: "image-x-1024x1024-webp" } },
  content: [],
};

describe("G1 BreadcrumbList", () => {
  it("emits a BreadcrumbList with Home and Blog crumbs", () => {
    const json = JSON.parse(buildBreadcrumbList([
      { name: "Home", path: "/" },
      { name: "Blog", path: "/blog" },
    ]));
    expect(json["@type"]).toBe("BreadcrumbList");
    expect(json.itemListElement).toHaveLength(2);
    expect(json.itemListElement[0]).toMatchObject({
      position: 1, name: "Home", item: "https://cosmicspiritguide.com/",
    });
    expect(json.itemListElement[1].item).toBe("https://cosmicspiritguide.com/blog");
  });

  it("3-level crumb includes the article", () => {
    const json = JSON.parse(buildBreadcrumbList([
      { name: "Home", path: "/" },
      { name: "Blog", path: "/blog" },
      { name: "Lions Gate Portal", path: "/blog/lions-gate-portal" },
    ]));
    expect(json.itemListElement).toHaveLength(3);
    expect(json.itemListElement[2].item).toBe("https://cosmicspiritguide.com/blog/lions-gate-portal");
  });
});

describe("G2 faqSchema flows through transformPost", () => {
  const faqSchema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [{ "@type": "Question", name: "Q?", acceptedAnswer: { "@type": "Answer", text: "A." } }],
  });

  it("reads faqSchema from raw and exposes it on seo", () => {
    const post = transformPost({ ...base, faqSchema }, "https://cosmicspiritguide.com");
    expect(post.seo.faqSchema).toBe(faqSchema);
  });

  it("defaults faqSchema to null when absent (no crash)", () => {
    const post = transformPost({ ...base }, "https://cosmicspiritguide.com");
    expect(post.seo.faqSchema).toBeNull();
  });
});
