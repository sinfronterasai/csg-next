import { assembleReading } from "@/lib/tarot/generate";
import { makeSeed } from "@/lib/tarot/draw";

describe("assembleReading (pure assembly)", () => {
  it("draws the right number of cards for the spread and builds a prompt", () => {
    const r = assembleReading({
      spreadId: "celtic_cross",
      question: "Should I move?",
      seed: makeSeed("x"),
    });
    expect(r.drawn.length).toBe(10);
    expect(r.prompt.user).toContain("Should I move?");
    expect(r.prompt.system.length).toBeGreaterThan(10);
  });

  it("includes astrology overlay when supplied", () => {
    const r = assembleReading({
      spreadId: "one_card",
      question: "Q",
      seed: makeSeed("o"),
      astrology: { summary: "Sun in Pisces" },
    });
    expect(r.astrology).toBeTruthy();
    expect(r.prompt.user).toContain("Sun in Pisces");
  });

  it("omits astrology when not supplied", () => {
    const r = assembleReading({ spreadId: "one_card", question: "Q", seed: makeSeed("o") });
    expect(r.astrology).toBeNull();
    expect(r.prompt.user.toLowerCase()).not.toContain("astrolog");
  });

  it("is deterministic for a fixed seed", () => {
    const a = assembleReading({ spreadId: "one_card", question: "Q", seed: makeSeed("o") });
    const b = assembleReading({ spreadId: "one_card", question: "Q", seed: makeSeed("o") });
    expect(a.drawn).toEqual(b.drawn);
  });

  it("throws on unknown spread", () => {
    expect(() => assembleReading({ spreadId: "nope", question: "Q", seed: 1 })).toThrow();
  });
});
