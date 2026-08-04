/** @jest-environment jsdom */
import { exportReadingPdf } from "@/lib/tarot/pdf";
import { buildReadingView, type ApiReading } from "@/lib/tarot/view";
import { deck } from "@/lib/tarot/deck";

const SUN = deck.find((c) => c.name === "The Sun")!;

const api: ApiReading = {
  spreadId: "one_card",
  question: "What now?",
  drawn: [
    {
      name: SUN.name,
      reversed: false,
      artRef: SUN.artRef,
      positionLabel: "Guidance",
      upright: SUN.upright,
      reversedMeaning: SUN.reversed,
    },
  ],
  interpretation: "Some reading text.",
  astrology: { summary: "Sun in Capricorn." },
  readingId: null,
  reflection: null,
};

describe("exportReadingPdf", () => {
  it("includes the drawn card image and the brand name in the print doc", () => {
    const opened: string[] = [];
    const fakeDoc = {
      write: (html: string) => opened.push(html),
      close: () => {},
    };
    const origOpen = window.open;
    // @ts-expect-error mock
    window.open = () => ({ document: fakeDoc, focus: () => {}, print: () => {} });
    jest.useFakeTimers();
    exportReadingPdf(buildReadingView(api));
    jest.useRealTimers();
    window.open = origOpen;

    const html = opened.join("");
    expect(html).toContain("Cosmic Spirit Guide");
    expect(html).toContain(SUN.artRef); // real card image src present
    expect(html).toContain("cosmicspiritguide.com"); // branded footer
  });
});
