/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import NamedTransitExplorer from '@/app/transits/NamedTransitExplorer';

const successfulResult = {
  contractVersion: 'named-transit.v1',
  experimentId: 'R-016-saturn-square-natal-moon',
  status: 'ready',
  transit: {
    body: 'saturn' as const,
    label: 'Saturn' as const,
    aspect: 'square' as const,
    target: 'moon' as const,
    targetLabel: 'Natal Moon' as const,
  },
  birth: {
    date: '1980-03-09',
    time: '16:21',
    location: 'Santa Cruz, CA',
    timezone: 'America/Los_Angeles',
    unknownTime: false as const,
  },
  calculation: {
    fromUtc: '2026-01-01T00:00:00.000Z',
    toUtc: '2026-12-31T00:00:00.000Z',
    orbDegrees: 1,
    scanStepHours: 6,
    stationarySpeedDegreesPerDay: 0.01,
    ephemeris: 'swiss-ephemeris' as const,
  },
  windows: [{
    id: 'window-1',
    startUtc: '2026-03-01T00:00:00Z',
    exactUtc: '2026-03-02T12:00:00Z',
    endUtc: '2026-03-04T00:00:00Z',
    phase: 'exact' as const,
    motion: 'direct' as const,
    minimumOrbDegrees: 0,
    precisionSeconds: 1,
  }],
  explanation: 'A deterministic Saturn square to the natal Moon is active.',
};

describe('NamedTransitExplorer account-save result actions', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders birth-chart and login links after a successful transit result', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ assignment: 'treatment', result: successfulResult, events: [] }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<NamedTransitExplorer />);
    fireEvent.change(screen.getByLabelText('Birth date'), { target: { value: '1980-03-09' } });
    fireEvent.change(screen.getByLabelText('Known birth time'), { target: { value: '16:21' } });
    fireEvent.change(screen.getByLabelText('Birth location'), { target: { value: 'Santa Cruz, CA' } });
    fireEvent.click(screen.getByRole('button', { name: 'Find my window' }));

    await waitFor(() => expect(screen.getByText('A deterministic Saturn square to the natal Moon is active.')).toBeTruthy());

    expect(fetchMock).toHaveBeenCalledWith('/api/transits/named', expect.objectContaining({
      method: 'POST',
    }));
    expect(screen.getByRole('link', { name: 'Save your birth chart' }).getAttribute('href')).toBe('/birth-chart');
    expect(screen.getByRole('link', { name: 'sign in' }).getAttribute('href')).toBe('/login');
  });
});
