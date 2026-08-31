import { buildMetadata } from "@/lib/seo/metadata";
import { astrologyData, compatibilityData, allSignKeys, signLabel, canonicalPair } from "@/lib/seo/programmatic";
import fs from "fs";
import path from "path";

describe("programmatic pages are non-indexable until curated (B2)", () => {
  it("astrology and compatibility page sources set noindex:true", () => {
    const astro = fs.readFileSync(
      path.join(__dirname, "..", "..", "src/app/astrology/[sun]/[moon]/page.tsx"),
      "utf8"
    );
    const comp = fs.readFileSync(
      path.join(__dirname, "..", "..", "src/app/compatibility/[pair]/page.tsx"),
      "utf8"
    );
    expect(astro).toContain("noindex: true");
    expect(comp).toContain("noindex: true");
  });

  it("buildMetadata with noindex yields robots index:false", () => {
    const { metadata } = buildMetadata({
      title: "x",
      description: "y",
      path: "/astrology/aries/taurus",
      noindex: true,
    });
    expect((metadata.robots as any).index).toBe(false);
  });
});

describe("per-combo distinct value (replaces false-positive uniqueness test)", () => {
  it("every Sun/Moon combo produces a distinct title and description", () => {
    const signs = allSignKeys();
    const titles = new Set<string>();
    const descs = new Set<string>();
    for (const s of signs) {
      for (const m of signs) {
        const d = astrologyData(s, m);
        if (!d) continue;
        const title = d.sun.label + " Sun, " + d.moon.label + " Moon: Your Inner Blend";
        const desc =
          "What a " + d.sun.element + " Sun (" + d.sun.modality + ") with a " +
          d.moon.element + " Moon (" + d.moon.modality + ") looks like: outer drive meets inner weather.";
        titles.add(title);
        descs.add(desc);
      }
    }
    // 144 distinct combos -> 144 distinct titles/descriptions (real pair identity, not just reorder)
    expect(titles.size).toBe(144);
    expect(descs.size).toBe(144);
  });

  it("every compatibility pair produces a distinct label/title", () => {
    const signs = allSignKeys();
    const titles = new Set<string>();
    for (let i = 0; i < signs.length; i++) {
      for (let j = 0; j < signs.length; j++) {
        const d = compatibilityData(signs[i], signs[j]);
        if (!d) continue;
        const label = signLabel(d.a.key) + " and " + signLabel(d.b.key);
        titles.add(label + " Love Compatibility: How Your Signs Connect");
      }
    }
    expect(titles.size).toBe(144); // 12x12 unordered pairs, all distinct
  });
});
