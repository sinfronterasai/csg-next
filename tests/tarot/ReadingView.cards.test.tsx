/** @jest-environment jsdom */
import { render, screen } from "@testing-library/react";
import ReadingView from "@/components/tarot/ReadingView";
import { buildReadingView, type ApiReading } from "@/lib/tarot/view";
import { deck, CARD_BACK_URL } from "@/lib/tarot/deck";

// A known card from the canonical deck (The Sun, id 19).
const SUN = deck.find((c) => c.name === "The Sun")!;

const api: ApiReading = {
  spreadId: "past_present_future",
  question: "What should I focus on?",
  drawn: [
    {
      name: SUN.name,
      reversed: false,
      artRef: SUN.artRef,
      positionLabel: "Past",
      upright: SUN.upright,
      reversedMeaning: SUN.reversed,
    },
  ],
  interpretation: "Some interpretation text.",
  astrology: null,
  readingId: null,
  reflection: null,
};

describe("ReadingView renders flip-cards (not text panels)", () => {
  it("renders the self-hosted card-back image via CardDeck/CardReveal", () => {
    const view = buildReadingView(api);
    render(<ReadingView reading={view} />);
    // The card-back image is unique to CardReveal; text panels never render it.
    const backs = screen.getAllByRole("img", { name: "Card back" });
    expect(backs.length).toBeGreaterThan(0);
    expect(backs[0].getAttribute("src")).toBe(CARD_BACK_URL);
  });

  it("renders the drawn card name and position label", () => {
    const view = buildReadingView(api);
    render(<ReadingView reading={view} />);
    expect(screen.getByText(SUN.name)).toBeTruthy();
    expect(screen.getByText("Past")).toBeTruthy();
  });
});
