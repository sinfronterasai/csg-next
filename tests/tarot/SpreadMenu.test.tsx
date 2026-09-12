/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SpreadMenu from '@/components/tarot/SpreadMenu';
import { buildReadingView } from '@/lib/tarot/view';

const GENERATED = {
  spreadId: 'past_present_future',
  question: 'What should I do?',
  drawn: [
    { name: 'The Sun', reversed: false, artRef: '/tarot/cards/sun.png', positionLabel: 'Past', upright: 'joy', reversedMeaning: 'delay' },
    { name: 'The Moon', reversed: true, artRef: '/tarot/cards/moon.png', positionLabel: 'Present', upright: 'dreams', reversedMeaning: 'confusion' },
    { name: 'The Star', reversed: false, artRef: '/tarot/cards/star.png', positionLabel: 'Future', upright: 'hope', reversedMeaning: 'disconnect' },
  ],
  interpretation: 'A reading.',
  astrology: null,
  readingId: 7,
};

const FIXED_GENERATED = {
  spreadId: 'one_card',
  question: 'What do I need to know right now?',
  drawn: [{ name: 'The Sun', reversed: false, artRef: '/tarot/cards/sun.png', positionLabel: 'Guidance', upright: 'joy', reversedMeaning: 'delay' }],
  interpretation: 'A one-card reading.',
  astrology: null,
  readingId: 8,
};

function mockFetch(map: Record<string, any>) {
  (global as any).fetch = jest.fn(async (url: string, opts: any) => {
    const key = Object.keys(map).find((k) => String(url).includes(k));
    const resp = key ? map[key] : { ok: true, status: 200, json: async () => ({}) };
    return { ok: resp.ok ?? true, status: resp.status ?? 200, json: async () => resp.body ?? resp };
  }) as any;
}

jest.mock('@/lib/tarot/view', () => ({
  buildReadingView: jest.fn((api) => ({ ...api, cards: (api.drawn || []).map((d: any) => ({ ...d })), drawn: (api.drawn || []).map((d: any) => ({ card: { name: d.name, artRef: d.artRef }, reversed: d.reversed, positionLabel: d.positionLabel })) })),
}));
jest.mock('@/components/tarot/ReadingView', () => ({ __esModule: true, default: ({ reading }: any) => <div data-testid="reading-view">{reading.question}</div> }));

describe('SpreadMenu (landing = spread grid)', () => {
  beforeEach(() => {
    (buildReadingView as jest.Mock).mockClear();
  });

  it('renders all 5 spreads with name, card count, blurb, and price label', () => {
    render(<SpreadMenu />);
    expect(screen.getByText('One Card')).toBeInTheDocument();
    expect(screen.getByText('Past · Present · Future')).toBeInTheDocument();
    expect(screen.getByText('Celtic Cross')).toBeInTheDocument();
    expect(screen.getByText('Relationship Dynamics')).toBeInTheDocument();
    expect(screen.getByText('Career Crossroads')).toBeInTheDocument();
    // price labels
    expect(screen.getAllByText('Free').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Member · $4.99').length).toBe(3);
    // tier badges: free spreads and premium spreads are both labelled
    expect(screen.getAllByText('Free', { selector: '[class*="uppercase"]' }).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Member', { selector: '[class*="uppercase"]' }).length).toBe(3);
    // card counts derived from positions length
    expect(screen.getAllByText('1 card').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('10 cards').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('6 cards').length).toBeGreaterThanOrEqual(2);
  });

  it('has no dead self-links to /tarot/ask or /tarot/spreads (AC7)', () => {
    const { container } = render(<SpreadMenu />);
    const links = Array.from(container.querySelectorAll('a[href]')).map((a) => (a as HTMLAnchorElement).href);
    expect(links.some((h) => h.includes('/tarot/ask'))).toBe(false);
    expect(links.some((h) => h.includes('/tarot/spreads'))).toBe(false);
    // quiet "My readings" link to history remains
    expect(links.some((h) => h.includes('/tarot/history'))).toBe(true);
  });

  it('AC2: selecting a non-fixed spread opens the question modal', () => {
    render(<SpreadMenu />);
    fireEvent.click(screen.getByText('Past · Present · Future'));
    expect(screen.getByText(/what.s your question/i)).toBeInTheDocument();
  });

  it('AC3: one-card spread draws immediately (no modal) with its fixed question', async () => {
    mockFetch({ '/api/tarot/generate': { body: FIXED_GENERATED } });
    render(<SpreadMenu />);
    fireEvent.click(screen.getByText('One Card'));
    await waitFor(() => expect(screen.getByTestId('reading-view')).toBeInTheDocument());
    const calls = ((global as any).fetch as jest.Mock).mock.calls;
    const gen = calls.find((c: any) => String(c[0]).includes('/api/tarot/generate'));
    expect(gen).toBeDefined();
    const body = JSON.parse(gen[1].body);
    expect(body.spreadId).toBe('one_card');
    expect(body.question).toBe('What do I need to know right now?');
  });
});

describe('QuestionModal (wired via SpreadMenu)', () => {
  beforeEach(() => { (buildReadingView as jest.Mock).mockClear(); });

  it('AC2: empty question blocks the API call and shows an inline error', async () => {
    mockFetch({ '/api/tarot/generate': { body: GENERATED } });
    render(<SpreadMenu />);
    fireEvent.click(screen.getByText('Past · Present · Future'));
    fireEvent.click(screen.getByText(/reveal my reading/i));
    expect(await screen.findByText(/please enter a question/i)).toBeInTheDocument();
    expect(((global as any).fetch as jest.Mock).mock.calls.find((c: any) => String(c[0]).includes('/api/tarot/generate'))).toBeUndefined();
  });

  it('AC2/AC4: a typed question submits and renders the reading', async () => {
    mockFetch({ '/api/tarot/generate': { body: GENERATED } });
    render(<SpreadMenu />);
    fireEvent.click(screen.getByText('Past · Present · Future'));
    const textarea = screen.getByPlaceholderText(/what.s your question/i) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'What should I do?' } });
    fireEvent.click(screen.getByText(/reveal my reading/i));
    await waitFor(() => expect(screen.getByTestId('reading-view')).toBeInTheDocument());
    const gen = ((global as any).fetch as jest.Mock).mock.calls.find((c: any) => String(c[0]).includes('/api/tarot/generate'));
    expect(JSON.parse(gen[1].body).question).toBe('What should I do?');
  });

  it('AC5: free user on a premium spread hits 403 and sees an in-modal upgrade CTA (no dead-end)', async () => {
    mockFetch({ '/api/tarot/generate': { ok: false, status: 403, body: { error: 'Upgrade', code: 'UPGRADE_REQUIRED', spreadId: 'celtic_cross' } } });
    render(<SpreadMenu />);
    fireEvent.click(screen.getByText('Celtic Cross'));
    const textarea = screen.getByPlaceholderText(/what.s your question/i) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Will I get the job?' } });
    fireEvent.click(screen.getByText(/reveal my reading/i));
    // Upgrade CTA appears in-modal, not a blank/404.
    const cta = await screen.findByText(/this is a member reading/i);
    expect(cta).toBeInTheDocument();
    // A link to pricing must be present (real destination, not a dead-end).
    const pricingLink = screen.getByRole('link', { name: /become a member|cosmic pass|\$4\.99/i });
    expect(pricingLink.getAttribute('href')).toMatch(/\/tarot\/pricing/);
  });
});
