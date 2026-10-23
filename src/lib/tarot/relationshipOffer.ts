export const RELATIONSHIP_OFFER_PATH = '/tarot/relationship-dynamics';
export const RELATIONSHIP_READING_PATH = '/tarot?spread=relationship_dynamics';
export const RELATIONSHIP_SAMPLE_SEED = 'csg-relationship-example-v1';

// Editorial demonstration using a reproducible draw from the real deck.
// Not a customer testimonial or a captured live AI response.
export const relationshipExample = [
  { position: 'You', card: 'Six of Wands', reversed: false, text: 'You may be looking for reassurance that your effort is seen. Before asking for a verdict on the relationship, name one concrete way you want to feel appreciated.' },
  { position: 'Them', card: 'Queen of Swords', reversed: true, text: 'Use this card to reflect on communication that feels guarded or sharp. It cannot establish what the other person thinks. Ask a clear question rather than filling the silence with an assumption.' },
  { position: 'Connection', card: 'Strength', reversed: true, text: 'The connection may feel harder to hold when either person is exhausted. Consider whether the conversation needs a calmer time, rather than more intensity.' },
  { position: 'Strength', card: 'The Magician', reversed: false, text: 'There is value in what you can actually do: choose your words, make a specific request, and follow through. One practical conversation can be more useful than trying to solve everything at once.' },
  { position: 'Tension', card: 'Knight of Wands', reversed: false, text: 'Enthusiasm can turn into rushing. Notice whether urgency is pushing you toward a decision before you have heard each other. Slow the pace enough to distinguish excitement from consistency.' },
  { position: 'Path', card: 'The Devil', reversed: true, text: 'A useful next step may be releasing a pattern that keeps the same argument alive. Name a boundary or habit you can change yourself. This is a reflection prompt, not a prediction of whether you will stay together.' },
] as const;
