import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MoonCalculator, { formatDegree } from '@/components/MoonCalculator';

describe('MoonCalculator presentation contract', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        birth: { date: '1990-06-15', time: '', location: 'Paris, France', unknownTime: true },
        moonSign: {
          key: 'pisces', signLabel: 'Pisces', signGlyph: '♓', degreeInSign: 14.2, longitude: 344.24579,
          element: 'Water', modality: 'Mutable', traits: ['Sensitive', 'Intuitive', 'Compassionate'],
          dates: 'Feb 19 – Mar 20', explanation: 'A receptive inner world.',
        },
        moonPhase: {
          phase: 0.5, label: 'Full Moon', illuminationPercent: 100, evaluatedAtUtc: '2026-09-27T00:00:00.000Z',
        },
      }),
    } as unknown as typeof fetch);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rounds to the nearest arcminute and carries minutes correctly', () => {
    expect(formatDegree(29 + 59.5 / 60)).toBe("30°00'");
    expect(formatDegree(344.24579)).toBe("344°15'");
  });

  it('shows truthful location, timestamp, illumination, and unknown-time disclosure', async () => {
    render(<MoonCalculator />);
    expect(screen.getByText('Used to determine the correct timezone for your birth time.')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("I don't know my exact birth time"));
    fireEvent.click(screen.getByRole('button', { name: /ALIGN WITH THE MOON/i }));

    await waitFor(() => expect(screen.getByText('Pisces')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /MOON PHASE/i }));
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText(/Current Moon phase — calculated Sep 27, 2026, 12:00 AM UTC/)).toBeInTheDocument();
    expect(screen.getByText(/Birth time unknown — calculated using 12:00 PM local time/)).toBeInTheDocument();
  });
});
