import { drawForSpread, makeSeed, type DrawnCard } from "@/lib/tarot/draw";
import { getSpread } from "@/lib/tarot/spreads";
import { buildInterpretationPrompt } from "@/lib/tarot/interpret";
import { getAstrologyOverlay } from "@/lib/tarot/astrology";
import { generateText } from "@/lib/groq";
import { saveReading } from "@/lib/tarot/store";

export interface AssembleArgs {
  spreadId: string;
  question: string;
  seed: number;
  astrology?: { summary: string; transits?: string } | null;
  userName?: string | null;
}

export interface AssembledReading {
  spreadId: string;
  question: string;
  drawn: DrawnCard[];
  prompt: { system: string; user: string };
  astrology: { summary: string; transits?: string } | null;
}

/** Pure assembly: draw + prompt build + astrology (no DB, no Groq). */
export function assembleReading(args: AssembleArgs): AssembledReading {
  const spread = getSpread(args.spreadId);
  if (!spread) throw new Error(`Unknown spread: ${args.spreadId}`);
  const drawn = drawForSpread(args.spreadId, args.seed);
  const prompt = buildInterpretationPrompt({
    question: args.question,
    spreadId: args.spreadId,
    drawn,
    astrology: args.astrology,
    userName: args.userName,
  });
  return {
    spreadId: args.spreadId,
    question: args.question,
    drawn,
    prompt,
    astrology: args.astrology ?? null,
  };
}

export interface GenerateArgs {
  spreadId: string;
  question: string;
  seed?: number | string;
  userId?: number | string | null;
  userName?: string | null;
  category?: string | null;
}

export interface GeneratedReading extends AssembledReading {
  interpretation: string;
  readingId: number | null;
}

/**
 * Full reading generation: draw, blend astrology (if authed + chart exists),
 * call Groq, and persist for authenticated users. Throws on Groq failure so
 * the route can return a real error (never a fake reading).
 */
export async function generateReading(args: GenerateArgs): Promise<GeneratedReading> {
  const seedNum = typeof args.seed === "string" ? makeSeed(args.seed) : args.seed ?? makeSeed(String(Date.now()));
  let astrology = null;
  if (args.userId != null) {
    astrology = await getAstrologyOverlay(args.userId);
  }
  const assembled = assembleReading({
    spreadId: args.spreadId,
    question: args.question,
    seed: seedNum,
    astrology,
    userName: args.userName,
  });

  const interpretation = await generateText(assembled.prompt.user, {
    systemPrompt: assembled.prompt.system,
    temperature: 0.85,
    max_tokens: 2200,
  });
  if (!interpretation) {
    throw new Error("Groq returned an empty reading.");
  }

  let readingId: number | null = null;
  if (args.userId != null) {
    const saved = await saveReading({
      userId: Number(args.userId),
      spreadId: args.spreadId,
      question: args.question,
      category: args.category ?? undefined,
      positions: assembled.drawn.map((d) => ({ label: d.positionLabel, meaning: "" })),
      cards: assembled.drawn.map((d) => ({ name: d.card.name, reversed: d.reversed, image: d.card.artRef })),
      interpretation,
      astrology: astrology as Record<string, unknown> | null,
    });
    readingId = saved.id;
  }

  return { ...assembled, interpretation, readingId };
}
