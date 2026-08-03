import { tierFeatureMatrix } from "@/lib/tarot/pricing";

describe("tierFeatureMatrix (pure)", () => {
  it("returns exactly three tiers in order free, premium, premium_plus", () => {
    const m = tierFeatureMatrix();
    expect(m.map((t) => t.tier)).toEqual(["free", "premium", "premium_plus"]);
  });

  it("free tier lists the two MVP free spreads and costs 0", () => {
    const free = tierFeatureMatrix().find((t) => t.tier === "free")!;
    expect(free.priceMonthly).toBe(0);
    expect(free.features.join(" ")).toContain("One Card");
    expect(free.features.join(" ")).toContain("Past");
  });

  it("premium tier is $4.99 and includes the three MVP premium spreads", () => {
    const prem = tierFeatureMatrix().find((t) => t.tier === "premium")!;
    expect(prem.priceMonthly).toBe(4.99);
    const f = prem.features.join(" ");
    expect(f).toContain("Celtic Cross");
    expect(f).toContain("Relationship Dynamics");
    expect(f).toContain("Career Crossroads");
  });

  it("premium_plus is $9.99 and notes astrology blends", () => {
    const pp = tierFeatureMatrix().find((t) => t.tier === "premium_plus")!;
    expect(pp.priceMonthly).toBe(9.99);
    expect(pp.features.join(" ")).toContain("Birth Chart");
  });

  it("each tier has a cta label", () => {
    for (const t of tierFeatureMatrix()) {
      expect(typeof t.cta).toBe("string");
      expect(t.cta.length).toBeGreaterThan(0);
    }
  });
});
