import { deck, type TarotCard } from "@/lib/tarot/deck";
import { type DrawnCard } from "@/lib/tarot/draw";

export interface ApiDrawnCard {
  name: string;
  reversed: boolean;
  artRef?: string;
  positionLabel: string;
  upright?: string;
  reversedMeaning?: string;
}

export interface ApiReading {
  spreadId: string;
  question: string;
  drawn: ApiDrawnCard[];
  interpretation: string;
  astrology: { summary: string; transits?: string } | null;
  readingId: number | null;
  reflection?: string | null;
}

export interface ReadingCardView {
  name: string;
  reversed: boolean;
  artRef?: string;
  positionLabel: string;
  meaning: string;
}

export interface ReadingViewModel {
  spreadId: string;
  question: string;
  cards: ReadingCardView[];
  /** Full drawn cards (with TarotCard) for the flip-card UI. */
  drawn: DrawnCard[];
  interpretation: string;
  astrology: { summary: string; transits?: string } | null;
  readingId: number | null;
  reflection?: string | null;
}

/** name -> TarotCard lookup so we can reconstruct a DrawnCard from the API. */
const deckByName: Map<string, TarotCard> = new Map(
  deck.map((c) => [c.name, c]),
);

/** Map an API reading response into a flat, render-ready view model. */
export function buildReadingView(api: ApiReading): ReadingViewModel {
  const drawn: DrawnCard[] = (api.drawn || []).map((d) => ({
    card:
      deckByName.get(d.name) ??
      ({
        id: d.name,
        name: d.name,
        suit: "major",
        upright: d.upright ?? "",
        reversed: d.reversedMeaning ?? "",
        artRef: d.artRef ?? "",
      } as TarotCard),
    reversed: d.reversed,
    positionIndex: 0,
    positionLabel: d.positionLabel,
  }));

  return {
    spreadId: api.spreadId,
    question: api.question,
    interpretation: api.interpretation,
    astrology: api.astrology ?? null,
    readingId: api.readingId ?? null,
    reflection: api.reflection ?? null,
    drawn,
    cards: (api.drawn || []).map((d) => ({
      name: d.name,
      reversed: d.reversed,
      artRef: d.artRef,
      positionLabel: d.positionLabel,
      meaning: d.reversed ? d.reversedMeaning || "" : d.upright || "",
    })),
  };
}
