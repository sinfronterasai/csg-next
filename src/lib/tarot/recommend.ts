import { spreadTierMet, type Tier } from '@/lib/tarot/entitlements';

export interface RecommendInput {
  question: string;
  category?: string | null;
  /** Caller's effective tier; null = anonymous. */
  tier: Tier | null;
}

export interface RecommendResult {
  spreadId: string;
  reason: string;
  /** True when the ideal spread was locked and we fell back to a free one. */
  fallback: boolean;
}

const FREE_FALLBACK = 'one_card';
const FREE_DECISION_FALLBACK = 'past_present_future';

const DECISION_RE = /\b(should|choose|decision|which|whether|stay|move|quit|take|leave|path|do i)\b/i;
const LOVE_RE = /\b(love|relationship|partner|boyfriend|girlfriend|marriage|date|ex|he|she|they|us|we)\b/i;
const CAREER_RE = /\b(career|job|work|boss|promotion|interview|business|money|finance|hire)\b/i;

function categoryHint(cat?: string | null): 'love' | 'career' | 'decision' | null {
  if (!cat) return null;
  const c = cat.toLowerCase();
  if (c.includes('love') || c.includes('relation')) return 'love';
  if (c.includes('career') || c.includes('work')) return 'career';
  if (c.includes('decision')) return 'decision';
  return null;
}

/**
 * Deterministic spread recommendation from a question + optional category,
 * respecting the caller's subscription tier. If the ideal spread is locked,
 * falls back to the best available free spread (never over-grants).
 */
export function recommendSpread(input: RecommendInput): RecommendResult {
  const q = (input.question || '').trim();
  const hint = categoryHint(input.category);

  // Resolve the ideal premium spread for this intent.
  let ideal: string | null = null;
  let reasonIdeal = '';

  if (hint === 'love' || LOVE_RE.test(q)) {
    ideal = 'relationship_dynamics';
    reasonIdeal = 'Your question centers on a relationship, so a Relationship Dynamics spread maps both sides of the bond.';
  } else if (hint === 'career' || CAREER_RE.test(q)) {
    ideal = 'career_crossroads';
    reasonIdeal = 'This reads as a career crossroads — the Career Crossroads spread clarifies the choice and what is blocking you.';
  } else if (hint === 'decision' || DECISION_RE.test(q)) {
    ideal = 'celtic_cross';
    reasonIdeal = 'You are weighing a decision; the Celtic Cross gives the full picture around it.';
  }

  // Short / generic questions with no clear intent -> One Card.
  if (!ideal && q.length < 12) {
    return { spreadId: FREE_FALLBACK, reason: 'A single card offers a focused nudge for an open question.', fallback: false };
  }

  // No clear intent but a fuller question -> Past Present Future (free, no fallback needed).
  if (!ideal) {
    return {
      spreadId: FREE_DECISION_FALLBACK,
      reason: 'Past · Present · Future frames the arc of your situation with a quick three-card view.',
      fallback: false,
    };
  }

  // If the caller can access the ideal spread, recommend it.
  const idealTier: Tier = ideal === 'celtic_cross' || ideal === 'relationship_dynamics' || ideal === 'career_crossroads' ? 'premium' : 'free';
  if (spreadTierMet(idealTier, input.tier)) {
    return { spreadId: ideal, reason: reasonIdeal, fallback: false };
  }

  // Locked: fall back to the best free spread for the intent.
  if (idealTier === 'premium') {
    const fb = hint === 'career' || CAREER_RE.test(q) || hint === 'decision' || DECISION_RE.test(q)
      ? FREE_DECISION_FALLBACK
      : FREE_FALLBACK;
    return {
      spreadId: fb,
      reason: `That spread is a Premium feature. Here is a free ${fb.replace(/_/g, ' ')} reading you can use now.`,
      fallback: true,
    };
  }

  return { spreadId: FREE_FALLBACK, reason: reasonIdeal, fallback: true };
}
