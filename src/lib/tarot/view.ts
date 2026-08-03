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
  interpretation: string;
  astrology: { summary: string; transits?: string } | null;
  readingId: number | null;
  reflection?: string | null;
}

/** Map an API reading response into a flat, render-ready view model. */
export function buildReadingView(api: ApiReading): ReadingViewModel {
  return {
    spreadId: api.spreadId,
    question: api.question,
    interpretation: api.interpretation,
    astrology: api.astrology ?? null,
    readingId: api.readingId ?? null,
    reflection: api.reflection ?? null,
    cards: (api.drawn || []).map((d) => ({
      name: d.name,
      reversed: d.reversed,
      artRef: d.artRef,
      positionLabel: d.positionLabel,
      meaning: d.reversed ? d.reversedMeaning || "" : d.upright || "",
    })),
  };
}
