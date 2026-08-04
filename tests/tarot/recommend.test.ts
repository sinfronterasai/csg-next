import { recommendSpread, type RecommendInput } from '@/lib/tarot/recommend';
import type { Tier } from '@/lib/tarot/spreads';

describe('recommendSpread (pure rules)', () => {
  it('love/relationship category -> relationship_dynamics for premium', () => {
    const r = recommendSpread({ question: 'Will we last?', category: 'love', tier: 'premium' });
    expect(r.spreadId).toBe('relationship_dynamics');
    expect(typeof r.reason).toBe('string');
    expect(r.reason.length).toBeGreaterThan(0);
  });

  it('career category -> career_crossroads for premium', () => {
    const r = recommendSpread({ question: 'Should I take the new job?', category: 'career', tier: 'premium' });
    expect(r.spreadId).toBe('career_crossroads');
  });

  it('decision keywords with no category -> celtic_cross for premium', () => {
    const r = recommendSpread({ question: 'Should I move cities or stay?', tier: 'premium' });
    expect(r.spreadId).toBe('celtic_cross');
  });

  it('free user requesting a premium spread falls back to a free spread (never over-grants)', () => {
    const r = recommendSpread({ question: 'Should I move cities or stay?', tier: 'free' });
    expect(r.spreadId).toBe('past_present_future'); // best free fallback for decisions
    expect(r.fallback).toBe(true);
  });

  it('love question for free user falls back to one_card (free)', () => {
    const r = recommendSpread({ question: 'Is he the one?', category: 'love', tier: 'free' });
    expect(['one_card', 'past_present_future']).toContain(r.spreadId);
    expect(r.fallback).toBe(true);
  });

  it('anonymous (tier null) defaults to free and never recommends premium', () => {
    const r = recommendSpread({ question: 'what career path', category: 'career', tier: null });
    expect(['one_card', 'past_present_future']).toContain(r.spreadId);
    expect((r as any).fallback).toBe(true);
  });

  it('short/generic question without category -> one_card even for premium', () => {
    const r = recommendSpread({ question: 'help', tier: 'premium' });
    expect(r.spreadId).toBe('one_card');
  });

  it('is deterministic: same input -> same output', () => {
    const a = recommendSpread({ question: 'Should I quit my job', category: 'career', tier: 'premium' });
    const b = recommendSpread({ question: 'Should I quit my job', category: 'career', tier: 'premium' });
    expect(a).toEqual(b);
  });
});
