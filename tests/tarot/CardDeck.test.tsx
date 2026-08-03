/** @jest-environment jsdom */
import { render, screen } from "@testing-library/react";
import CardDeck from "@/components/tarot/CardDeck";
import { drawForSpread, makeSeed } from "@/lib/tarot/draw";

describe("CardDeck render", () => {
  it("renders one_card with the drawn card name revealed after interval", () => {
    const drawn = drawForSpread("one_card", makeSeed("x"));
    render(<CardDeck spreadId="one_card" drawn={drawn} />);
    // card name appears in the DOM (initially on the front face)
    expect(screen.getByText(drawn[0].card.name)).toBeTruthy();
  });

  it("renders all 10 celtic cross position labels", () => {
    const drawn = drawForSpread("celtic_cross", makeSeed("cc"));
    render(<CardDeck spreadId="celtic_cross" drawn={drawn} />);
    const { getSpread } = require("@/lib/tarot/spreads");
    for (const p of getSpread("celtic_cross")!.positions) {
      expect(screen.getAllByText(p.label).length).toBeGreaterThan(0);
    }
  });
});
