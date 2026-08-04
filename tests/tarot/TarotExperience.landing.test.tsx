/**
 * Task 1 (RED): guided-entry landing.
 * Landing must render a hero headline + 4 quick-action buttons, and the
 * category chips must set active state on click (not be no-ops).
 */
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TarotExperience from '@/components/tarot/TarotExperience';

const RECOMMEND = {
  spreadId: 'one_card',
  reason: 'A single card gives quick clarity.',
  fallbackFree: true,
};
const GENERATED = {
  readingId: 123,
  spreadId: 'one_card',
  question: 'Will I find love this year?',
  cards: [{ position: 'Guidance', cardId: 9, name: 'The Hermit', reversed: false, meaning: 'Soul searching.' }],
  interpretation: 'Some guidance text.',
  astrology: null,
};

beforeEach(() => {
  const json = (obj: any) => ({ ok: true, status: 200, json: async () => obj, text: async () => JSON.stringify(obj) });
  (global as any).fetch = jest.fn(async (url: string) => {
    if (String(url).includes('/api/tarot/recommend')) return json(RECOMMEND);
    if (String(url).includes('/api/tarot/generate')) return json(GENERATED);
    return json({});
  }) as any;
});

describe('Tarot guided-entry landing', () => {
  it('renders a hero headline and MVP quick actions (no Daily link)', () => {
    render(<TarotExperience />);
    // Hero headline from spec S10.1
    expect(screen.getByText(/what is calling for your attention/i)).toBeInTheDocument();
    // Quick actions: Ask the Cards / Daily / Browse / History
    expect(screen.getByText(/ask the cards/i)).toBeInTheDocument();
    expect(screen.getByText(/browse spreads/i)).toBeInTheDocument();
    expect(screen.getByText(/my history/i)).toBeInTheDocument();
    // MVP scope (spec S18) excludes Daily; no broken link to /tarot/daily
    expect(screen.queryByText(/daily reading/i)).not.toBeInTheDocument();
  });

  it('category chips set active state on click (not no-ops)', () => {
    render(<TarotExperience />);
    const love = screen.getByRole('button', { name: /love/i });
    fireEvent.click(love);
    // active chip should be marked (aria-pressed or data-active)
    expect(love).toHaveAttribute('aria-pressed', 'true');
    const career = screen.getByRole('button', { name: /career/i });
    expect(career).toHaveAttribute('aria-pressed', 'false');
  });
});
