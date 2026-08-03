import { layoutForSpread } from "@/lib/tarot/layout";
import { getSpread } from "@/lib/tarot/spreads";

describe("spread layout (pure)", () => {
  it("one_card -> single cell", () => {
    const l = layoutForSpread("one_card");
    expect(l.positions.length).toBe(1);
    expect(l.columns).toBe(1);
    expect(l.positions[0].col).toBe(1);
    expect(l.positions[0].row).toBe(1);
  });

  it("past_present_future -> 3 cells in a row", () => {
    const l = layoutForSpread("past_present_future");
    expect(l.positions.length).toBe(3);
    expect(l.columns).toBe(3);
    l.positions.forEach((p, i) => {
      expect(p.row).toBe(1);
      expect(p.col).toBe(i + 1);
      expect(p.label).toBe(getSpread("past_present_future")!.positions[i].label);
    });
  });

  it("celtic_cross -> 10 cells with a defined grid", () => {
    const l = layoutForSpread("celtic_cross");
    expect(l.positions.length).toBe(10);
    expect(l.columns).toBeGreaterThanOrEqual(3);
    // every cell has valid grid coords
    for (const p of l.positions) {
      expect(p.col).toBeGreaterThanOrEqual(1);
      expect(p.row).toBeGreaterThanOrEqual(1);
      expect(typeof p.label).toBe("string");
    }
  });

  it("throws on unknown spread", () => {
    expect(() => layoutForSpread("nope")).toThrow();
  });
});
