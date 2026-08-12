export type Tier = 'free' | 'premium' | 'premium_plus';

export interface SpreadPosition {
  label: string;
  meaning: string;
}

export interface Spread {
  id: string;
  name: string;
  tier: Tier;
  /** Display-only price string for the spread menu. Free -> "Free", premium -> "Member · $4.99". */
  priceLabel: string;
  /** Short description shown on the picker. */
  blurb: string;
  positions: SpreadPosition[];
  /**
   * When set, selecting this spread draws immediately with this question,
   * skipping the question modal. Undefined -> the modal is required.
   */
  fixedQuestion?: string;
}

// MVP set per resolved tier model (2026-08-03):
//   Free: One Card, Past Present Future
//   Premium ($4.99): Celtic Cross, Relationship Dynamics, Career Crossroads
export const spreads: Spread[] = [
  {
    id: 'one_card',
    name: 'One Card',
    tier: 'free',
    priceLabel: 'Free',
    blurb: 'A single card for a quick, focused insight.',
    fixedQuestion: 'What do I need to know right now?',
    positions: [{ label: 'Guidance', meaning: 'The core energy or message for your question right now.' }],
  },
  {
    id: 'past_present_future',
    name: 'Past · Present · Future',
    tier: 'free',
    priceLabel: 'Free',
    blurb: 'See how the situation evolved and where it is heading.',
    positions: [
      { label: 'Past', meaning: 'The root or energy that has led to this moment.' },
      { label: 'Present', meaning: 'The current state and the forces at play now.' },
      { label: 'Future', meaning: 'The likely outcome if things continue as they are.' },
    ],
  },
  {
    id: 'celtic_cross',
    name: 'Celtic Cross',
    tier: 'premium',
    priceLabel: 'Member · $4.99',
    blurb: 'The classic 10-card deep dive into any situation.',
    positions: [
      { label: '1 · Present', meaning: 'The situation as it stands today.' },
      { label: '2 · Challenge', meaning: 'The immediate obstacle or crossing energy.' },
      { label: '3 · Crown', meaning: 'Your conscious goal or best outcome.' },
      { label: '4 · Past', meaning: 'The foundation beneath the situation.' },
      { label: '5 · Passing', meaning: 'What is fading or moving away.' },
      { label: '6 · Future', meaning: 'What is coming into being next.' },
      { label: '7 · Self', meaning: 'How you see yourself in this.' },
      { label: '8 · Environment', meaning: 'External influences and the people around you.' },
      { label: '9 · Hopes/Fears', meaning: 'Your inner hopes and anxieties.' },
      { label: '10 · Outcome', meaning: 'The long-term resolution.' },
    ],
  },
  {
    id: 'relationship_dynamics',
    name: 'Relationship Dynamics',
    tier: 'premium',
    priceLabel: 'Member · $4.99',
    blurb: 'Map the energies between you and another person.',
    positions: [
      { label: 'You', meaning: 'Your energy and stance in the relationship.' },
      { label: 'Them', meaning: 'The other person’s energy and stance.' },
      { label: 'Connection', meaning: 'The bond or dynamic between you.' },
      { label: 'Strength', meaning: 'What strengthens this relationship.' },
      { label: 'Tension', meaning: 'The friction or challenge to address.' },
      { label: 'Path', meaning: 'Where this relationship is heading.' },
    ],
  },
  {
    id: 'career_crossroads',
    name: 'Career Crossroads',
    tier: 'premium',
    priceLabel: 'Member · $4.99',
    blurb: 'Clarity for a work or direction decision.',
    positions: [
      { label: 'Current Path', meaning: 'Where your career stands now.' },
      { label: 'The Choice', meaning: 'The decision in front of you.' },
      { label: 'Strength', meaning: 'Your assets and advantages.' },
      { label: 'Blind Spot', meaning: 'What you may be overlooking.' },
      { label: 'Obstacle', meaning: 'The main blocker to progress.' },
      { label: 'Outcome', meaning: 'Likely result of the best move.' },
    ],
  },
];

export function getSpread(id: string): Spread | undefined {
  return spreads.find((s) => s.id === id);
}
