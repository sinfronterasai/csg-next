import {
  escapeJsonLd,
  organizationJsonLd,
  websiteJsonLd,
  articleJsonLd,
  breadcrumbJsonLd,
  faqPageJsonLd,
  webApplicationJsonLd,
  mergeJsonLd,
} from "@/lib/seo/jsonld";

describe("jsonld", () => {
  test("escapeJsonLd neutralizes script-breaking chars", () => {
    const bad = '{"x":"</script> < > &"}';
    const out = escapeJsonLd(bad);
    expect(out).not.toContain("</script>");
    expect(out).toContain("\\u003c");
  });

  test("faqPageJsonLd gates on visible content", () => {
    expect(faqPageJsonLd(undefined)).toBeNull();
    expect(faqPageJsonLd([])).toBeNull();
    expect(faqPageJsonLd([{ question: "Q?", answer: "" }])).toBeNull();
    const j = faqPageJsonLd([{ question: "Q?", answer: "A." }]) as any;
    expect(j["@type"]).toBe("FAQPage");
    expect(j.mainEntity.length).toBe(1);
  });

  test("webApplicationJsonLd gates on description", () => {
    expect(webApplicationJsonLd({ name: "x" })).toBeNull();
    const j = webApplicationJsonLd({ description: "real" }) as any;
    expect(j["@type"]).toBe("WebApplication");
  });

  test("articleJsonLd shapes BlogPosting", () => {
    const j = articleJsonLd({
      headline: "H",
      description: "D",
      url: "https://cosmicspiritguide.com/blog/x",
    }) as any;
    expect(j["@type"]).toBe("BlogPosting");
    expect(j.publisher.name).toBe("Cosmic Spirit Guide");
  });

  test("breadcrumbJsonLd uses prod host", () => {
    const j = breadcrumbJsonLd([{ name: "Home", path: "/" }]) as any;
    expect(j.itemListElement[0].item).toBe("https://cosmicspiritguide.com/");
  });

  test("mergeJsonLd drops nulls", () => {
    const out = mergeJsonLd(organizationJsonLd(), null, websiteJsonLd());
    expect(out.length).toBe(2);
  });
});
