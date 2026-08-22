import { generateText, GROQ_MODEL } from '@/lib/groq';

// This test exercises the REAL Groq endpoint. It is skipped automatically when
// no GROQ_API_KEY is present (CI without secrets) so it never hard-fails there.
const KEY = process.env.GROQ_API_KEY;
const describeOrSkip = KEY ? describe : describe.skip;

describeOrSkip('groq integration (tarot reading model)', () => {
  it('uses a model that actually exists on this key', () => {
    expect(GROQ_MODEL).toBe('qwen/qwen3.6-27b');
  });

  it('returns clean prose (no <think> reasoning block) for a reading prompt', async () => {
    const out = await generateText(
      'Give a one-sentence tarot-style reflection on the question: "Should I change careers?"',
      { systemPrompt: 'You are a warm, concise tarot reader.', temperature: 0.8, max_tokens: 400 },
    );
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(10);
    expect(out).not.toMatch(/<think>/i); // reasoning block must be stripped
  }, 30000);
});
