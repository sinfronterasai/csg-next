import { buildMetadata } from "@/lib/seo/metadata";
import { astrologyData, compatibilityData, allSignKeys, signLabel, canonicalPair } from "@/lib/seo/programmatic";
import { isProgrammaticApproved, programmaticComboKey } from "@/lib/seo/programmatic-approval";
import fs from "fs";
import path from "path";

describe("programmatic pages are held (fail-closed), not merely noindex (B2/C3)", () => {
  it("approval registry is empty by default => every combo is unavailable (fail-closed)", () => {
    for (const s of allSignKeys()) {
      for (const m of allSignKeys()) {
        expect(isProgrammaticApproved("astrology", s, m)).toBe(false);
      }
    }
    for (let i = 0; i < allSignKeys().length; i++) {
      for (let j = i + 1; j < allSignKeys().length; j++) {
        const [a, b] = canonicalPair(allSignKeys()[i], allSignKeys()[j]);
        expect(isProgrammaticApproved("compatibility", a, b)).toBe(false);
      }
    }
  });

  it("combo key helper is order-independent and namespaced", () => {
    expect(programmaticComboKey("compatibility", "libra", "aries")).toBe("compatibility:aries-libra");
    expect(programmaticComboKey("compatibility", "aries", "libra")).toBe("compatibility:aries-libra");
    expect(programmaticComboKey("astrology", "aries", "taurus")).toBe("astrology:aries-taurus");
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

describe("hubs do not link to held template pages (C3)", () => {
  function read(p: string) {
    return fs.readFileSync(path.join(__dirname, "..", "..", p), "utf8");
  }
  it("/astrology hub has no link to a Sun/Moon combo slug", () => {
    const src = read("src/app/astrology/page.tsx");
    expect(src).not.toMatch(/\/astrology\/[a-z]+\/[a-z]+/);
  });
  it("/compatibility hub has no link to a pair slug", () => {
    const src = read("src/app/compatibility/page.tsx");
    expect(src).not.toMatch(/\/compatibility\/[a-z]+-and-[a-z]+/);
  });
});

describe("data still derives distinct values (informational only; not a quality claim)", () => {
  it("astrologyData resolves every combo (route scaffolding intact)", () => {
    const signs = allSignKeys();
    let resolved = 0;
    for (const s of signs) for (const m of signs) if (astrologyData(s, m)) resolved++;
    expect(resolved).toBe(144);
  });
  it("compatibilityData resolves every canonical pair (route scaffolding intact)", () => {
    const signs = allSignKeys();
    let resolved = 0;
    for (let i = 0; i < signs.length; i++)
      for (let j = i + 1; j < signs.length; j++)
        if (compatibilityData(signs[i], signs[j])) resolved++;
    expect(resolved).toBe(66);
  });
});
