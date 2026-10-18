import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import TarotArchetypeQuiz from "./TarotArchetypeQuiz";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: "What's Your Tarot Archetype? | Cosmic Spirit Guide",
    description: "Answer 6 questions to explore the tarot themes that reflect how you move through life. Free, with no signup needed.",
    path: "/quizzes/tarot-archetype",
    type: "website",
    og: {
      title: "What's Your Tarot Archetype?",
      description: "Answer 6 questions to discover the tarot archetype that reflects how you move through life. Free, no signup.",
    },
  }).metadata;
}

export default function TarotArchetypePage() {
  return <TarotArchetypeQuiz />;
}
