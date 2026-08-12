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

describe('SpreadMenu fixes', () => {
  beforeEach(() => { (buildReadingView as jest.Mock).mockClear(); });

  // Violation 1: retain the typed question across a failed draw.
  it('retains the typed question when a draw fails (no retype)', async () => {
    mockFetch({ '/api/tarot/generate': { ok: false, status: 500, body: { error: 'Our interpreter is unavailable right now.' } } });
    render(<SpreadMenu />);
    fireEvent.click(screen.getByText('Past · Present · Future'));
    const ta = screen.getByPlaceholderText(/what.s your question/i) as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: 'Will I get the job?' } });
    fireEvent.click(screen.getByText(/reveal my reading/i));
    // Modal reopens with the question preserved and the error surfaced.
    const retained = await screen.findByDisplayValue('Will I get the job?');
    expect(retained).toBeInTheDocument();
    expect(screen.getByText(/interpreter is unavailable/i)).toBeInTheDocument();
  });

  // Violation 2: "New reading" must reset phase, not soft-nav to the same route.
  it('"New reading" returns to the spread menu', async () => {
    mockFetch({ '/api/tarot/generate': { body: GENERATED } });
    render(<SpreadMenu />);
    fireEvent.click(screen.getByText('Past · Present · Future'));
    const ta = screen.getByPlaceholderText(/what.s your question/i) as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: 'What should I do?' } });
    fireEvent.click(screen.getByText(/reveal my reading/i));
    await waitFor(() => expect(screen.getByTestId('reading-view')).toBeInTheDocument());
    fireEvent.click(screen.getByText('New reading'));
    // Menu is back: spread cards visible again.
    expect(await screen.findByText('One Card')).toBeInTheDocument();
  });

  // Violation 3: result controls need >=44px touch targets.
  it('result controls expose a >=44px hit area', async () => {
    mockFetch({ '/api/tarot/generate': { body: GENERATED } });
    render(<SpreadMenu />);
    fireEvent.click(screen.getByText('Past · Present · Future'));
    const ta = screen.getByPlaceholderText(/what.s your question/i) as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: 'What should I do?' } });
    fireEvent.click(screen.getByText(/reveal my reading/i));
    await waitFor(() => expect(screen.getByTestId('reading-view')).toBeInTheDocument());
    expect(screen.getByText('New reading')).toHaveClass('min-h-[44px]');
    expect(screen.getByText('My readings')).toHaveClass('min-h-[44px]');
  });
});
