/**
 * Task 2 (RED): spread recommendation + selection.
 * After submit, the recommended spread is shown; the user can choose a
 * different spread from a picker, and the chosen spreadId is what gets
 * drawn (not the auto-recommended one).
 */
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TarotExperience from '@/components/tarot/TarotExperience';
import { spreads } from '@/lib/tarot/spreads';

const RECOMMEND = {
  spreadId: 'one_card',
  spreadName: 'One Card',
  reason: 'A single card gives quick clarity.',
  fallback: true,
};
const GENERATED = {
  readingId: 123,
  spreadId: 'one_card',
  question: 'Will I find love this year?',
  cards: [{ position: 'Guidance', cardId: 9, name: 'The Hermit', reversed: false, meaning: 'Soul searching.' }],
  interpretation: 'Some guidance text.',
  astrology: null,
};

let lastGenerateBody: any = null;

beforeEach(() => {
  lastGenerateBody = null;
  const json = (obj: any) => ({ ok: true, status: 200, json: async () => obj, text: async () => JSON.stringify(obj) });
  (global as any).fetch = jest.fn(async (url: string, opts: any) => {
    if (String(url).includes('/api/tarot/recommend')) return json(RECOMMEND);
    if (String(url).includes('/api/tarot/generate')) {
      lastGenerateBody = opts && opts.body ? JSON.parse(opts.body) : null;
      return json(GENERATED);
    }
    return json({});
  }) as any;
});

describe('Tarot spread selection', () => {
  it('shows the recommended spread and a way to choose a different one', async () => {
    render(<TarotExperience />);
    const textarea = screen.getByPlaceholderText(/what is on your mind/i) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Will I find love this year?' } });
    fireEvent.click(screen.getByText(/recommend a spread/i));
    // Recommended spread is surfaced
    await waitFor(() => expect(screen.getByText(/one card/i)).toBeInTheDocument());
    // A control to choose a different spread must exist
    expect(screen.getByText(/choose different spread/i)).toBeInTheDocument();
  });

  it('draws the USER-SELECTED spread, not the auto-recommended one', async () => {
    render(<TarotExperience />);
    const textarea = screen.getByPlaceholderText(/what is on your mind/i) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Will I find love this year?' } });
    fireEvent.click(screen.getByText(/recommend a spread/i));
    await waitFor(() => expect(screen.getByText(/choose different spread/i)).toBeInTheDocument());
    // Open the picker and pick the Celtic Cross (a different spread)
    fireEvent.click(screen.getByText(/choose different spread/i));
    const celtic = screen.getByText(/celtic cross/i);
    fireEvent.click(celtic);
    // The generate call must use the chosen spreadId
    await waitFor(() => expect(lastGenerateBody).not.toBeNull());
    expect(lastGenerateBody.spreadId).toBe('celtic_cross');
    // And it must NOT be the recommended one_card
    expect(lastGenerateBody.spreadId).not.toBe('one_card');
  });
});
