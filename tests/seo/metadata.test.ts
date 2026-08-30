import { buildMetadata } from "@/lib/seo/metadata";

describe("buildMetadata", () => {
  test("prod host emits indexable prod canonical", () => {
    const { metadata } = buildMetadata({
      title: "T",
      description: "D",
      path: "/about",
      runtime: { host: "cosmicspiritguide.com" },
    });
    const m = metadata as any;
    expect(m.alternates.canonical).toBe("https://cosmicspiritguide.com/about");
    expect(m.robots.index).toBe(true);
    expect(m.robots.follow).toBe(true);
  });

  test("preview host emits noindex + self canonical", () => {
    const { metadata } = buildMetadata({
      title: "T",
      description: "D",
      path: "/about",
      runtime: { host: "csg-next.onrender.com" },
    });
    const m = metadata as any;
    expect(m.robots.index).toBe(false);
    expect(m.robots.follow).toBe(false);
    expect(m.alternates.canonical).toBe("https://csg-next.onrender.com/about");
  });

  test("noindex flag forces noindex even on prod", () => {
    const { metadata } = buildMetadata({
      title: "T",
      description: "D",
      path: "/login",
      noindex: true,
      runtime: { host: "cosmicspiritguide.com" },
    });
    const m = metadata as any;
    expect(m.robots.index).toBe(false);
    expect(m.alternates.canonical).toBe("https://cosmicspiritguide.com/login");
  });

  test("article type carries published time", () => {
    const { metadata } = buildMetadata({
      title: "T",
      description: "D",
      path: "/blog/x",
      type: "article",
      publishedTime: "2026-08-17",
      runtime: { host: "cosmicspiritguide.com" },
    });
    const m = metadata as any;
    expect(m.openGraph.type).toBe("article");
    expect(m.openGraph.publishedTime).toBe("2026-08-17");
  });
});
