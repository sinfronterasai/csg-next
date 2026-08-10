import { sanityImageUrl, safeAlt } from "@/lib/sanity/image";

describe("sanityImageUrl", () => {
  const img = (ref: string, alt = "") => ({ _type: "image", alt, asset: { _ref: ref } });

  it("builds a cdn url with only default quality/format when no dims given", () => {
    const url = sanityImageUrl(img("image-5dfca6192680dc091a03f1d7ecb8e7e004fcda1f-1024x1024-webp"));
    expect(url).toContain("https://cdn.sanity.io/images/kicslgfz/production/5dfca6192680dc091a03f1d7ecb8e7e004fcda1f-1024x1024.webp");
    expect(url).toContain("q=80");
    expect(url).toContain("auto=format");
    expect(url).not.toContain("w=");
    expect(url).not.toContain("h=");
  });

  it("adds width/height when explicitly provided", () => {
    const url = sanityImageUrl(img("image-5dfca6192680dc091a03f1d7ecb8e7e004fcda1f-1024x1024-webp"), { width: 1200 });
    expect(url).toContain("w=1200");
    expect(url).toContain("q=80");
    expect(url).toContain("auto=format");
  });

  it("returns null when asset ref missing", () => {
    expect(sanityImageUrl({ _type: "image", asset: null })).toBeNull();
    expect(sanityImageUrl(null)).toBeNull();
    expect(sanityImageUrl(undefined)).toBeNull();
  });
});

describe("safeAlt", () => {
  it("uses provided alt when non-empty", () => {
    expect(safeAlt({ _type: "image", alt: "A lion", asset: {} }, "fallback")).toBe("A lion");
  });
  it("backfills when alt is empty", () => {
    expect(safeAlt({ _type: "image", alt: "", asset: {} }, "Fallback Title")).toBe("Fallback Title");
    expect(safeAlt({ _type: "image", alt: null, asset: {} }, "FB")).toBe("FB");
  });
});
