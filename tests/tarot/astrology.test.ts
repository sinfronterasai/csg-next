import { summarizeChart } from "@/lib/tarot/astrology";

const fixture = {
  planets: [
    { key: "sun", label: "Sun", sign: "capricorn", signLabel: "Capricorn" },
    { key: "moon", label: "Moon", sign: "libra", signLabel: "Libra" },
    { key: "venus", label: "Venus", sign: "scorpio", signLabel: "Scorpio" },
  ],
  ascendant: "Gemini",
  midheaven: "Aquarius",
};

describe("summarizeChart (pure astrology overlay)", () => {
  it("extracts Sun, Moon, and Ascendant labels into a summary string", () => {
    const s = summarizeChart(fixture as any);
    expect(s).toContain("Capricorn");
    expect(s).toContain("Libra");
    expect(s).toContain("Gemini");
  });

describe("summarizeChart with real object-shaped chart_data", () => {
  const real = {
    planets: {
      sun: { sign: "pisces", degree: 19.2, longitude: 349.2 },
      moon: { sign: "libra", degree: 3.1, longitude: 183.1 },
    },
    ascendant: "Gemini",
  };
  it("reads planet signs from an object map and labels them", () => {
    const s = summarizeChart(real as any);
    expect(s).toContain("Sun in Pisces");
    expect(s).toContain("Moon in Libra");
    expect(s).toContain("Ascendant in Gemini");
  });
  it("handles ascendant as an object too", () => {
    const s = summarizeChart({ planets: { sun: { sign: "aries" } }, ascendant: { sign: "scorpio" } } as any);
    expect(s).toContain("Sun in Aries");
    expect(s).toContain("Ascendant in Scorpio");
  });
});

  it("returns a stable, non-empty summary", () => {
    const s = summarizeChart(fixture as any);
    expect(typeof s).toBe("string");
    expect(s.trim().length).toBeGreaterThan(0);
  });

  it("returns null/empty when chart data is missing or malformed", () => {
    expect(summarizeChart(null as any)).toBe("");
    expect(summarizeChart({} as any)).toBe("");
    expect(summarizeChart({ planets: [] } as any)).toBe("");
  });

  it("handles missing ascendant gracefully", () => {
    const s = summarizeChart({ planets: [{ key: "sun", signLabel: "Aries" }] } as any);
    expect(s).toContain("Aries");
  });
});
