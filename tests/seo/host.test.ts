import {
  isProductionHost,
  getCanonicalProdHost,
  getActiveBaseUrl,
  isPreviewEnv,
  getXRobotsTag,
  resolveCanonicalUrl,
} from "@/lib/seo/host";

describe("host helpers", () => {
  const OLD = process.env;
  beforeEach(() => {
    process.env = { ...OLD };
    delete process.env.NEXT_PUBLIC_PROD_HOST;
    delete process.env.NEXT_PUBLIC_CANONICAL_HOST;
    delete process.env.NEXT_PUBLIC_BASE_URL;
  });
  afterAll(() => {
    process.env = OLD;
  });

  test("isProductionHost whitelists apex + www", () => {
    expect(isProductionHost("cosmicspiritguide.com")).toBe(true);
    expect(isProductionHost("www.cosmicspiritguide.com")).toBe(true);
    expect(isProductionHost("cosmicspiritguide.com:443")).toBe(true);
    expect(isProductionHost("csg-next.onrender.com")).toBe(false);
    expect(isProductionHost(null)).toBe(false);
    expect(isProductionHost(undefined)).toBe(false);
  });

  test("getXRobotsTag noindex on preview, null on prod", () => {
    expect(getXRobotsTag("csg-next.onrender.com")).toBe("noindex, nofollow");
    expect(getXRobotsTag("localhost:3000")).toBe("noindex, nofollow");
    expect(getXRobotsTag("cosmicspiritguide.com")).toBeNull();
  });

  test("resolveCanonicalUrl is env-aware", () => {
    expect(resolveCanonicalUrl("/about", "cosmicspiritguide.com")).toBe(
      "https://cosmicspiritguide.com/about"
    );
    expect(resolveCanonicalUrl("/about", "csg-next.onrender.com")).toBe(
      "https://csg-next.onrender.com/about"
    );
    // no host => active base url (prod default)
    expect(resolveCanonicalUrl("about", null)).toBe(
      "https://cosmicspiritguide.com/about"
    );
  });

  test("isPreviewEnv true when base url is not prod host", () => {
    process.env.NEXT_PUBLIC_BASE_URL = "https://csg-next.onrender.com";
    expect(isPreviewEnv()).toBe(true);
    process.env.NEXT_PUBLIC_BASE_URL = "https://cosmicspiritguide.com";
    expect(isPreviewEnv()).toBe(false);
  });
});
