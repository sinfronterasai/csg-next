/**
 * Regression: route-specific canonicals for the six legal/commercial pages.
 *
 * Live defect reproduced on csg-pr-15.onrender.com (migration preview): each of
 * /privacy /terms /contact /about /pricing /services emitted the HOMEPAGE
 * canonical ("https://cosmicspiritguide.com") instead of its own path.
 *
 * These tests exercise each page's real generateMetadata() so the exact exported
 * wiring is covered — not just buildMetadata() in isolation — and assert the
 * canonical is the page's own absolute production URL.
 */
import { generateMetadata as privacyMeta } from "@/app/privacy/page";
import { generateMetadata as termsMeta } from "@/app/terms/page";
import { generateMetadata as contactMeta } from "@/app/contact/page";
import { generateMetadata as aboutMeta } from "@/app/about/page";
import { generateMetadata as pricingMeta } from "@/app/pricing/page";
import { generateMetadata as servicesMeta } from "@/app/services/page";

const CASES: Array<{ path: string; meta: () => Promise<any> }> = [
  { path: "/privacy", meta: privacyMeta as any },
  { path: "/terms", meta: termsMeta as any },
  { path: "/contact", meta: contactMeta as any },
  { path: "/about", meta: aboutMeta as any },
  { path: "/pricing", meta: pricingMeta as any },
  { path: "/services", meta: servicesMeta as any },
];

describe("legal/commercial route-specific canonicals (migration defect)", () => {
  for (const { path, meta } of CASES) {
    it(`${path} canonicalizes to itself, not the homepage`, async () => {
      const metadata = await meta();
      const canonical =
        typeof metadata.alternates?.canonical === "string"
          ? metadata.alternates.canonical
          : (metadata.alternates?.canonical as any)?.url;
      // Must be the page's own absolute prod URL, never the bare homepage.
      expect(canonical).toBe(`https://cosmicspiritguide.com${path}`);
      expect(canonical).not.toBe("https://cosmicspiritguide.com");
    });

    it(`${path} openGraph url matches its own canonical`, async () => {
      const metadata = await meta();
      expect((metadata.openGraph as any)?.url).toBe(
        `https://cosmicspiritguide.com${path}`,
      );
    });
  }
});
