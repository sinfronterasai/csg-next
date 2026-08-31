import { buildMetadata } from "@/lib/seo/metadata";

describe("buildMetadata canonical/robots contract (B1/B9)", () => {
  it("emits an absolute production canonical regardless of request host", () => {
    const { metadata } = buildMetadata({
      title: "X",
      description: "Y",
      path: "/birth-chart",
      runtime: { host: "csg-next.onrender.com" },
    });
    expect((metadata.alternates as any).canonical).toBe("https://cosmicspiritguide.com/birth-chart");
  });

  it("emits prod canonical even with no host (localhost/build)", () => {
    const { metadata } = buildMetadata({ title: "X", description: "Y", path: "/about" });
    expect((metadata.alternates as any).canonical).toBe("https://cosmicspiritguide.com/about");
  });

  it("noindex is honored in every environment (B2)", () => {
    const { metadata } = buildMetadata({
      title: "X",
      description: "Y",
      path: "/astrology/aries/taurus",
      noindex: true,
      runtime: { host: "cosmicspiritguide.com" },
    });
    expect((metadata.robots as any).index).toBe(false);
    expect((metadata.robots as any).follow).toBe(false);
  });

  it("indexable pages keep index/follow and full social tags", () => {
    const { metadata } = buildMetadata({
      title: "Home",
      description: "Desc",
      path: "/",
      runtime: { host: "cosmicspiritguide.com" },
    });
    expect((metadata.robots as any).index).toBe(true);
    expect((metadata.openGraph as any).title).toBe("Home");
    expect((metadata.twitter as any).card).toBe("summary_large_image");
  });
});
