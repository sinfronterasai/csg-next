import { buildReadingView, type ApiReading } from "@/lib/tarot/view";

const api: ApiReading = {
  spreadId: "celtic_cross",
  question: "Should I move?",
  drawn: [
    { name: "The Sun", reversed: false, artRef: "x", positionLabel: "Present", upright: "u", reversedMeaning: "r" },
    { name: "The Moon", reversed: true, artRef: "y", positionLabel: "Challenge", upright: "u2", reversedMeaning: "r2" },
  ],
  interpretation: "Your reading text.",
  astrology: { summary: "Sun in Pisces" },
  readingId: 42,
};

describe("buildReadingView (pure view model)", () => {
  it("maps drawn cards to position+orientation+meaning", () => {
    const v = buildReadingView(api);
    expect(v.cards.length).toBe(2);
    expect(v.cards[0]).toMatchObject({ name: "The Sun", positionLabel: "Present", reversed: false, meaning: "u" });
    expect(v.cards[1]).toMatchObject({ name: "The Moon", positionLabel: "Challenge", reversed: true, meaning: "r2" });
  });

  it("carries question, interpretation, astrology, readingId", () => {
    const v = buildReadingView(api);
    expect(v.question).toBe("Should I move?");
    expect(v.interpretation).toBe("Your reading text.");
    expect(v.astrology).toEqual({ summary: "Sun in Pisces" });
    expect(v.readingId).toBe(42);
  });

  it("handles missing astrology gracefully", () => {
    const v = buildReadingView({ ...api, astrology: null });
    expect(v.astrology).toBeNull();
  });

  it("readingId may be null for anonymous users", () => {
    const v = buildReadingView({ ...api, readingId: null });
    expect(v.readingId).toBeNull();
  });
});
