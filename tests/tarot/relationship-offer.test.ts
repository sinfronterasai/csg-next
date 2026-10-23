import { drawForSpread, makeSeed } from '@/lib/tarot/draw';
import { relationshipExample, RELATIONSHIP_SAMPLE_SEED } from '@/lib/tarot/relationshipOffer';

it('the disclosed editorial sample uses the actual six-card engine draw', () => {
  const drawn = drawForSpread('relationship_dynamics', makeSeed(RELATIONSHIP_SAMPLE_SEED));
  expect(relationshipExample.map(({position, card, reversed}) => ({position, card, reversed}))).toEqual(
    drawn.map(d => ({position:d.positionLabel,card:d.card.name,reversed:d.reversed})),
  );
});
