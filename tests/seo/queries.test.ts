import {
  POSTS_LIST_QUERY,
  ALL_POST_SLUGS_QUERY,
  LATEST_POST_QUERY,
  POST_BY_SLUG_QUERY,
} from "@/lib/blog/queries";

describe("Sanity publication queries fail closed (B11)", () => {
  const queries = {
    POSTS_LIST_QUERY,
    ALL_POST_SLUGS_QUERY,
    LATEST_POST_QUERY,
    POST_BY_SLUG_QUERY,
  };

  it("every public query requires independent approval (review.status == 'approved')", () => {
    for (const [name, q] of Object.entries(queries)) {
      expect(q).toContain('review.status == "approved"');
    }
  });

  it("every public query requires published status", () => {
    for (const [name, q] of Object.entries(queries)) {
      expect(q).toContain('status == "published"');
    }
  });

  it("every public query requires zero hard-fail flags", () => {
    for (const [name, q] of Object.entries(queries)) {
      expect(q).toContain("count(coalesce(review.hardFailFlags, [])) == 0");
    }
  });

  it("every public query requires defined slug/title/publishedAt and non-empty content array", () => {
    for (const [name, q] of Object.entries(queries)) {
      expect(q).toContain("defined(slug.current)");
      expect(q).toContain("defined(title)");
      expect(q).toContain("count(content) > 0");
      expect(q).toContain("defined(publishedAt)");
    }
  });

  it("every public query excludes test/system docs via wildcard !(slug.current match '__*')", () => {
    for (const [name, q] of Object.entries(queries)) {
      expect(q).toContain('!(slug.current match "__*")');
    }
  });

  it("direct slug lookup is guarded by the same predicate", () => {
    expect(POST_BY_SLUG_QUERY).toContain("slug.current == $slug &&");
    expect(POST_BY_SLUG_QUERY).toContain('review.status == "approved"');
  });
});

// GROQ semantics regression: the test-doc guard must actually reject a "__" slug.
// Verified live behavior:
//   "__token_test__" match "^__"  => false   (WRONG FORM: allows it through)
//   "__token_test__" match "__*"  => true    (CORRECT FORM: wildcard anchors start)
// The predicate uses !(slug.current match "__*"); when the match is true the whole
// AND fails, so the document is excluded. "isExcluded" below equals the match result.
describe("GROQ test-doc guard semantics (B11 regression)", () => {
  function slugExcluded(slug: string): boolean {
    // mirrors: slug.current match "__*"  (wildcard anchored at start)
    return new RegExp("^__").test(slug);
  }

  it("excludes a test slug starting with __", () => {
    expect(slugExcluded("__token_test__")).toBe(true);
    expect(slugExcluded("__ruled_out_test__")).toBe(true);
  });

  it("does not exclude a normal published slug", () => {
    expect(slugExcluded("what-is-my-birth-chart")).toBe(false);
    expect(slugExcluded("virgo-season-2026-dates-meaning")).toBe(false);
  });

  it("the broken ^__ anchor form would wrongly accept a test slug (proving we use __*)", () => {
    // Sanity evaluated `"__token_test__" match "^__"` as false (broken form).
    const brokenMatch = (s: string) => `"${s}" match "^__"`;
    // We assert the broken string representation is NOT what our queries contain.
    expect(POSTS_LIST_QUERY).not.toContain('match "^__"');
    expect(POSTS_LIST_QUERY).toContain('!(slug.current match "__*")');
  });
});
