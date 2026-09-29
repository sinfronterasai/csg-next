/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import NamedTransitExplorer from '@/app/transits/NamedTransitExplorer';

const successfulResult = {
  contractVersion: 'next-major-transit.v1',
  nextTransit: {
    mover: 'jupiter',
    moverLabel: 'Jupiter',
    aspect: 'trine',
    target: 'venus',
    targetLabel: 'Venus',
    status: 'UPCOMING',
    activeWindow: { startUtc: '2026-10-01T00:00:00Z', endUtc: '2026-10-10T00:00:00Z' },
    strongestDate: '2026-10-05T00:00:00Z',
    primaryPhase: 'applying',
    shortInterpretation: 'Jupiter supports your natal Venus.',
  },
  significantTransitCount: 3,
  searchPeriod: { fromUtc: '2026-09-28T00:00:00Z', toUtc: '2027-09-28T00:00:00Z', displayTimezone: 'America/Los_Angeles' },
};

describe('NamedTransitExplorer next-major-transit contract', () => {
  afterEach(() => jest.restoreAllMocks());

  it('renders the bounded result, premium CTA, and account actions', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ result: successfulResult, events: [] }) });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<NamedTransitExplorer />);
    fireEvent.change(screen.getByLabelText('Birth Date'), { target: { value: '1980-03-09' } });
    fireEvent.change(screen.getByLabelText('Birth Time'), { target: { value: '16:21' } });
    fireEvent.change(screen.getByLabelText('Birth Location'), { target: { value: 'Santa Cruz, CA' } });
    fireEvent.click(screen.getByRole('button', { name: 'Find My Next Transit' }));

    await waitFor(() => expect(screen.getByText('Jupiter trine natal Venus')).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledWith('/api/transits/next', expect.objectContaining({ method: 'POST' }));
    expect(screen.getByText('We found 3 significant transit periods in your next 12 months.')).toBeTruthy();
    expect(screen.getByRole('link', { name: /12-Month Transit Forecast/ }).getAttribute('href')).toBe('/reports');
    expect(screen.getByRole('link', { name: 'Save your birth chart' }).getAttribute('href')).toBe('/birth-chart');
    expect(screen.getByRole('link', { name: 'sign in' }).getAttribute('href')).toBe('/login');
  });
});
