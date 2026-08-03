import { drawCards, drawForSpread, makeSeed } from "@/lib/tarot/draw";
import { deck } from "@/lib/tarot/deck";
import { getSpread } from "@/lib/tarot/spreads";

describe("draw logic (seeded)", () => {
  it("drawCards returns the requested count of distinct cards", () => {
    const drawn = drawCards(3, makeSeed("abc"));
    expect(drawn.length).toBe(3);
    const names = drawn.map((d) => d.card.name);
    expect(new Set(names).size).toBe(3);
  });

  it("is deterministic: same seed -> same cards and reversal flags", () => {
    const a = drawCards(5, makeSeed("seed-1"));
    const b = drawCards(5, makeSeed("seed-1"));
    expect(a).toEqual(b);
  });

  it("different seeds produce different draws (extremely likely)", () => {
    const a = drawCards(5, makeSeed("seed-A"));
    const b = drawCards(5, makeSeed("seed-B"));
    expect(a).not.toEqual(b);
  });

  it("does not exceed deck size and never repeats within one draw", () => {
    const drawn = drawCards(78, makeSeed("full"));
    expect(drawn.length).toBe(78);
    expect(new Set(drawn.map((d) => d.card.name)).size).toBe(78);
  });

  it("every drawn card has a boolean reversed flag", () => {
    for (const d of drawCards(10, makeSeed("rev"))) {
      expect(typeof d.reversed).toBe("boolean");
    }
  });

  it("drawForSpread aligns one card per position for Celtic Cross (10)", () => {
    const drawn = drawForSpread("celtic_cross", makeSeed("cc"));
    const spread = getSpread("celtic_cross")!;
    expect(drawn.length).toBe(spread.positions.length);
    drawn.forEach((d, i) => {
      expect(d.positionIndex).toBe(i);
      expect(d.positionLabel).toBe(spread.positions[i].label);
    });
  });

  it("uses the full 78-card deck as the source", () => {
    const drawn = drawCards(78, makeSeed("full"));
    for (const d of drawn) {
      expect(deck.find((c) => c.name === d.card.name)).toBeDefined();
    }
  });
});
