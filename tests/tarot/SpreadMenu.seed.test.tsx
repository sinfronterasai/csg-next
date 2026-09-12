/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SpreadMenu from '@/components/tarot/SpreadMenu';

const GENERATED = {
  spreadId: 'one_card',
  question: 'What do I need to know right now?',
  drawn: [{ name: 'The Sun', reversed: false, artRef: '/tarot/cards/sun.png', positionLabel: 'Card 1', upright: 'joy', reversedMeaning: 'delay' }],
  interpretation: 'A reading.',
  astrology: null,
  readingId: 7,
};

function mockGenerate(sink: any[]) {
  (global as any).fetch = jest.fn(async (_url: string, opts: any) => {
    sink.push(JSON.parse(opts.body));
    return { ok: true, status: 200, json: async () => GENERATED };
  }) as any;
}

jest.mock('@/lib/tarot/view', () => ({
  buildReadingView: (api: any) => ({
    ...api,
    cards: (api.drawn || []).map((d: any) => ({ ...d })),
    drawn: (api.drawn || []).map((d: any) => ({ card: { name: d.name, artRef: d.artRef }, reversed: d.reversed, positionLabel: d.positionLabel })),
  }),
}));
jest.mock('@/components/tarot/ReadingView', () => ({ __esModule: true, default: ({ reading }: any) => <div data-testid="reading-view">{reading.question}</div> }));

describe('SpreadMenu seed rotation', () => {
  it('draws a fresh seed on each draw (repeat draws vary)', async () => {
    const bodies: any[] = [];
    mockGenerate(bodies);
    render(<SpreadMenu />);
    // First One Card draw (fixed question -> immediate, no modal).
    fireEvent.click(screen.getByText('One Card'));
    await waitFor(() => expect(screen.getByTestId('reading-view')).toBeInTheDocument());
    // Back to the menu.
    fireEvent.click(screen.getByText('New reading'));
    await waitFor(() => expect(screen.getByText('One Card')).toBeInTheDocument());
    // Second draw of the same spread.
    fireEvent.click(screen.getByText('One Card'));
    await waitFor(() => expect(screen.getByTestId('reading-view')).toBeInTheDocument());
    expect(bodies.length).toBe(2);
    expect(bodies[0].seed).toBeDefined();
    expect(bodies[0].seed).not.toEqual(bodies[1].seed);
  });
});
