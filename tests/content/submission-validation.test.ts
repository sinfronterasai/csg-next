import { validateSubmission } from "@/lib/blog/submissionValidation";

const review = { status: "pass", reviewer: "Reviewer", reviewedAt: "2026-11-24T19:30:00Z", notes: "Reviewed." };
const image = (key: string, role: string) => ({ key, role, assetId: `image-${"a".repeat(40)}-1200x800-jpg`, alt: `Illustration ${key}`, rights: { source: "CSG", license: "owned" } });
function validPackage(): any {
  return { schemaVersion: "1.1", submissionId: "01JCX8Q2M4T9VK3B7N5R0W6Y8D", revision: 1, baseRevision: null, submittedAt: "2026-11-24T20:15:00Z", title: "Test article", slug: "test-article", excerpt: "A test excerpt", body: "## First\nText\n[[image:first]]\n## Second\nText\n[[image:second]]", category: "astrology", primaryKeyword: "test", metaTitle: "Test article", metaDescription: "Description", images: [image("featured", "featured"), image("first", "inline"), image("second", "inline")], claims: [{ id: "c1", text: "Claim", status: "sourced", sourceIds: ["s1"] }], sources: [{ id: "s1", title: "Source", publisher: "Publisher", url: "https://example.org", accessedAt: "2026-11-24", supports: ["c1"] }], reviews: { editorial: review, factCheck: review, culture: review, accessibility: review, images: review } };
}
describe("editorial submission validation", () => {
  it("accepts a complete package", () => expect(validateSubmission(validPackage())).toEqual([]));
  it("rejects blocked reviews, missing assets and invalid source links before writing", () => {
    const p = validPackage();
    p.reviews.culture = { ...review, status: "block" };
    p.images[1].assetId = "image-placeholder";
    p.claims[0].sourceIds = ["s99"];
    const paths = validateSubmission(p).map(e => e.path);
    expect(paths).toEqual(expect.arrayContaining(["reviews.culture.status", "images[1].assetId", "claims[0].sourceIds"]));
  });
  it("requires image and accessibility reviews to pass", () => {
    const p = validPackage();
    p.reviews.images = { ...review, status: "block" };
    p.reviews.accessibility = { ...review, status: "pass-with-changes" };
    expect(validateSubmission(p).map(e => e.path)).toEqual(expect.arrayContaining(["reviews.images.status", "reviews.accessibility.status"]));
  });
  it("rejects an unplaced image and a mismatched retry base", () => {
    const p = validPackage();
    p.body = "## First\n[[image:first]]";
    p.revision = 2;
    p.baseRevision = 2;
    expect(validateSubmission(p).map(e => e.path)).toEqual(expect.arrayContaining(["baseRevision", "images[2].key"]));
  });
  it("requires test submissions to use a public-query-excluded slug", () => {
    const p = validPackage(); p.testOnly = true;
    expect(validateSubmission(p).map(e => e.path)).toContain("slug");
    p.slug = "__test-editorial-intake";
    expect(validateSubmission(p)).toEqual([]);
    delete p.testOnly;
    expect(validateSubmission(p).map(e => e.path)).toContain("slug");
  });
});
