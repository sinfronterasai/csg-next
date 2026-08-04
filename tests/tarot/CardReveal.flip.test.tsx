/** @jest-environment jsdom */
import { render } from "@testing-library/react";
import CardReveal from "@/components/tarot/CardReveal";
import { deck } from "@/lib/tarot/deck";

const SUN = deck.find((c) => c.name === "The Sun")!;

describe("CardReveal flip orientation", () => {
  it("back face carries rotateY(180deg) so it shows when unrevealed", () => {
    const { container } = render(
      <CardReveal card={SUN} reversed={false} revealed={false} />,
    );
    const back = container.querySelector('img[alt="Card back"]')!.parentElement!;
    expect(back.className).toContain("rotateY(180deg)");
  });

  it("front face has no rotateY of its own (shows when revealed)", () => {
    const { container } = render(
      <CardReveal card={SUN} reversed={false} revealed={true} />,
    );
    const front = container.querySelector(`img[alt="${SUN.name}"]`)!.parentElement!;
    expect(front.className).not.toContain("rotateY(180deg)");
    expect(front.className).toContain("backface-visibility:hidden");
  });
});
