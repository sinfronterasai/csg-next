import { buildInterpretationPrompt } from "@/lib/tarot/interpret";
import { drawForSpread, makeSeed } from "@/lib/tarot/draw";

const drawn = drawForSpread("celtic_cross", makeSeed("cc"));

describe("buildInterpretationPrompt", () => {
  it("includes the question, spread name, and every position+card", () => {
    const q = "Should I change careers?";
    const { system, user } = buildInterpretationPrompt({
      question: q,
      spreadId: "celtic_cross",
      drawn,
    });
    expect(system.length).toBeGreaterThan(20);
    expect(user).toContain(q);
    expect(user).toContain("Celtic Cross");
    for (const d of drawn) {
      expect(user).toContain(d.card.name);
      expect(user).toContain(d.positionLabel);
      expect(user).toContain(d.reversed ? "Reversed" : "Upright");
    }
  });

  it("omits astrology section when none provided", () => {
    const { user } = buildInterpretationPrompt({
      question: "Q",
      spreadId: "one_card",
      drawn: drawForSpread("one_card", makeSeed("o")),
    });
    expect(user.toLowerCase()).not.toContain("astrolog");
  });

  it("includes astrology overlay when provided", () => {
    const { user } = buildInterpretationPrompt({
      question: "Q",
      spreadId: "one_card",
      drawn: drawForSpread("one_card", makeSeed("o")),
      astrology: { summary: "Sun in Capricorn, Moon in Libra", transits: "Saturn square Venus" },
    });
    expect(user.toLowerCase()).toContain("astrology");
    expect(user).toContain("Sun in Capricorn");
    expect(user).toContain("Saturn square Venus");
  });

  it("is deterministic for the same inputs", () => {
    const args = { question: "Q", spreadId: "one_card", drawn: drawForSpread("one_card", makeSeed("o")) };
    expect(buildInterpretationPrompt(args)).toEqual(buildInterpretationPrompt(args));
  });
});
