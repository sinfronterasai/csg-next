import { canonicalPair, allSignKeys, zodiacData, compatibilityData } from "@/lib/seo/programmatic";
import { programmaticComboKey } from "@/lib/seo/programmatic-approval";

describe("programmatic content derivation", () => {
  test("canonicalPair is order-independent", () => {
    expect(canonicalPair("taurus", "aries")).toEqual(["aries", "taurus"]);
    expect(canonicalPair("aries", "taurus")).toEqual(["aries", "taurus"]);
  });

  test("all 12 signs resolve with real data", () => {
    for (const k of allSignKeys()) {
      const d = zodiacData(k);
      expect(d).not.toBeNull();
      expect(d!.sign.element.length).toBeGreaterThan(0);
      expect(d!.sign.ruler.length).toBeGreaterThan(0);
    }
  });

  test("compatibility canonical is alphabetical pair", () => {
    const d = compatibilityData("leo", "cancer");
    expect(d!.canonical).toBe("/compatibility/cancer-and-leo");
    expect(d!.sharedElement).toBe(false);
  });

  test("astrology combo never throws for valid signs", () => {
    const d = compatibilityData("aries", "aries");
    expect(d).not.toBeNull();
  });

  test("single-key families use the documented approval key format", () => {
    expect(programmaticComboKey("zodiac", "leo", "ignored")).toBe("zodiac:leo");
    expect(programmaticComboKey("horoscope", "virgo", "ignored")).toBe("horoscope:virgo");
    expect(programmaticComboKey("transits", "2026-09-03", "ignored")).toBe("transits:2026-09-03");
  });

  test("pair families retain their ordering contracts", () => {
    expect(programmaticComboKey("astrology", "leo", "aries")).toBe("astrology:leo-aries");
    expect(programmaticComboKey("compatibility", "leo", "aries")).toBe("compatibility:aries-leo");
  });
});
