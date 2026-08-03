import { buildRecommendResponse } from '@/lib/tarot/recommendApi';

describe('POST /api/tarot/recommend payload', () => {
  it('anonymous career question -> free fallback with spreadName', async () => {
    const res = await buildRecommendResponse(null, { question: 'Should I change jobs', category: 'career' });
    expect(res.tier).toBe('free');
    expect(res.recommendation.fallback).toBe(true);
    expect(res.recommendation.spreadName).toBeTruthy();
    expect(['One Card', 'Past · Present · Future']).toContain(res.recommendation.spreadName);
  });

  it('returns a valid spreadName for the recommended spread', async () => {
    const res = await buildRecommendResponse(1, { question: 'Is our love real', category: 'love' });
    expect(res.recommendation.spreadId).toBeTruthy();
    expect(typeof res.recommendation.spreadName).toBe('string');
    expect(res.recommendation.spreadName.length).toBeGreaterThan(0);
  });
});

import { pool } from '@/lib/db';
afterAll(async () => { await new Promise((r)=>setTimeout(r,100)); await pool.end().catch(()=>{}); });
