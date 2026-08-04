import { getSpread } from "@/lib/tarot/spreads";
import type { DrawnCard } from "@/lib/tarot/draw";

export interface AstrologyOverlay {
  summary?: string;
  transits?: string;
  [key: string]: string | undefined;
}

export interface InterpretArgs {
  question: string;
  spreadId: string;
  drawn: DrawnCard[];
  astrology?: AstrologyOverlay | null;
  userName?: string | null;
}

export interface InterpretationPrompt {
  system: string;
  user: string;
}

const SYSTEM = [
  "You are a warm, insightful tarot reader for Cosmic Spirit Guide.",
  "You write in a calm, second-person voice. For each card position, give a",
  "grounded interpretation that connects the card's meaning to the querent's",
  "question. Weave astrology in only where it is provided. Never invent",
  "predictions as certainties; speak in terms of energies, themes, and choices.",
  "Keep the full reading focused and readable.",
].join(" ");

export function buildInterpretationPrompt(args: InterpretArgs): InterpretationPrompt {
  const spread = getSpread(args.spreadId);
  if (!spread) throw new Error(`Unknown spread: ${args.spreadId}`);

  const lines: string[] = [];
  lines.push(`Question: ${args.question}`);
  if (args.userName) lines.push(`Querent: ${args.userName}`);
  lines.push(`Spread: ${spread.name}`);
  if (spread.blurb) lines.push(`Spread focus: ${spread.blurb}`);
  lines.push("");
  lines.push("Drawn cards (position : card [orientation] - position meaning):");
  for (const d of args.drawn) {
    const orient = d.reversed ? "Reversed" : "Upright";
    lines.push(`- ${d.positionLabel}: ${d.card.name} [${orient}] — ${d.card[orient === "Reversed" ? "reversed" : "upright"]}`);
  }

  if (args.astrology && (args.astrology.summary || args.astrology.transits)) {
    lines.push("");
    lines.push("Astrology overlay (blend subtly):");
    if (args.astrology.summary) lines.push(`Birth chart: ${args.astrology.summary}`);
    if (args.astrology.transits) lines.push(`Current transits: ${args.astrology.transits}`);
  }

  lines.push("");
  lines.push("Write the reading now, one short paragraph per position followed by a brief synthesis.");

  return { system: SYSTEM, user: lines.join(String.fromCharCode(10)) };
}
