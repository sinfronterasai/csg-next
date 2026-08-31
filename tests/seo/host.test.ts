import { resolveCanonicalUrl, getXRobotsTag, getCanonicalProdHost } from "@/lib/seo/host";

describe("host/canonical strategy (B9)", () => {
  it("resolveCanonicalUrl always returns the production canonical host", () => {
    expect(resolveCanonicalUrl("/birth-chart", "csg-next.onrender.com")).toBe(
      "https://" + getCanonicalProdHost() + "/birth-chart"
    );
    expect(resolveCanonicalUrl("/about", "localhost:3000")).toBe(
      "https://" + getCanonicalProdHost() + "/about"
    );
    expect(resolveCanonicalUrl("/", null)).toBe("https://" + getCanonicalProdHost() + "/");
  });

  it("preview hosts are noindex while canonical points to prod", () => {
    expect(getXRobotsTag("csg-next.onrender.com")).toBe("noindex, nofollow");
    expect(getXRobotsTag("localhost:3000")).toBe("noindex, nofollow");
    expect(getXRobotsTag("cosmicspiritguide.com")).toBeNull();
  });
});
