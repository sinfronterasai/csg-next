/**
 * RED test for the "spreadId and question are required" tarot bug.
 * Repro: user types a question, clicks Recommend, the generate call must carry that question.
 * Today the question is dropped (global __tarotQuestion + getElementById("q") mismatch),
 * so generate receives question:"" and the API returns 400.
 */
// jsdom env supplied via tests/tarot/jest.dom.config.js
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TarotExperience from '@/components/tarot/TarotExperience';
import * as view from '@/lib/tarot/view';

jest.mock('@/lib/tarot/view', () => ({
  buildReadingView: jest.fn(() => ({ ok: true })),
}));
jest.mock('@/components/tarot/ReadingView', () => ({
  __esModule: true,
  default: () => null,
}));

const RECOMMEND = { recommendation: { spreadId: 'celtic_cross', spreadName: 'Celtic Cross', reason: 'x', fallback: false }, tier: 'free' };
const GENERATED = { spreadId: 'celtic_cross', question: 'Will I find love this year?', drawn: [], interpretation: 'ok', astrology: null, readingId: 'r1' };

describe('TarotExperience question threading', () => {
  beforeEach(() => {
    (view.buildReadingView as jest.Mock).mockReturnValue({ ok: true });
    const json = (obj: any) => ({ ok: true, status: 200, json: async () => obj, text: async () => JSON.stringify(obj) });
    (global as any).fetch = jest.fn(async (url: string, opts: any) => {
      if (String(url).includes('/api/tarot/recommend')) return json(RECOMMEND);
      if (String(url).includes('/api/tarot/generate')) return json(GENERATED);
      return json({});
    }) as any;
  });

  it('forwards the typed question to /api/tarot/generate (not an empty string)', async () => {
    render(<TarotExperience />);
    const textarea = screen.getByPlaceholderText(/what is on your mind/i) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Will I find love this year?' } });
    fireEvent.click(screen.getByText(/recommend a spread/i));

    await waitFor(() => {
      const calls = ((global as any).fetch as jest.Mock).mock.calls;
      const gen = calls.find((c: any) => String(c[0]).includes('/api/tarot/generate'));
      expect(gen).toBeDefined();
    });

    const genCall = ((global as any).fetch as jest.Mock).mock.calls.find((c: any) => String(c[0]).includes('/api/tarot/generate'));
    const body = JSON.parse(genCall[1].body);
    expect(body.question).toBe('Will I find love this year?');
  });
});
