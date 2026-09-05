/** @jest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ReportsView from '@/app/reports/ReportsView';

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

const jsonResponse = (body: unknown, status = 200) =>
  Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => body } as Response);

async function resumeOwnedReport(response: Record<string, unknown>) {
  const fetchMock = jest.fn()
    .mockImplementationOnce(() => jsonResponse({ alreadyPurchased: true, purchaseId: 'purchase-1' }))
    .mockImplementationOnce(() => jsonResponse(response));
  global.fetch = fetchMock as unknown as typeof fetch;
  render(<ReportsView />);
  fireEvent.click(screen.getByRole('button', { name: /buy now/i }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
}

describe('ReportsView paid-report delivery gate', () => {
  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  it.each([
    ['dispatch_failed', 'failed'],
    ['needs_editor', 'editorial review'],
    ['rejected', 'not approved'],
    ['missing-content', 'could not complete'],
    ['unknown', 'determine the status'],
  ])('shows %s as a truthful non-ready state without dossier controls', async (status, message) => {
    await resumeOwnedReport({ success: true, mode: 'repeat', status, readingId: 41, reportId: 'report-1' });

    expect(screen.getByText(new RegExp(message, 'i'))).toBeTruthy();
    expect(screen.queryByText(/your celestial dossier/i)).toBeNull();
    expect(screen.queryByText(/download pdf/i)).toBeNull();
    expect(screen.queryByText(/^share$/i)).toBeNull();
  });

  it('does not render a ready response whose report content is empty', async () => {
    await resumeOwnedReport({ success: true, mode: 'repeat', status: 'approved', title: 'Love Blueprint', overview: [], sections: [] });

    expect(screen.queryByText(/your celestial dossier/i)).toBeNull();
    expect(screen.queryByText(/download pdf/i)).toBeNull();
  });

  it('renders an approved response with non-empty report content', async () => {
    await resumeOwnedReport({
      success: true,
      mode: 'repeat',
      status: 'approved',
      title: 'Love Blueprint',
      overview: [{ label: 'Venus', value: 'Pisces' }],
      sections: [{ heading: 'How You Love', body: 'You connect through empathy.' }],
    });

    expect(screen.getByText(/your celestial dossier/i)).toBeTruthy();
    expect(screen.getByText(/download pdf/i)).toBeTruthy();
  });

  it('renders approved sections even when the optional overview is empty', async () => {
    await resumeOwnedReport({
      success: true, mode: 'repeat', status: 'approved', title: 'Love Blueprint', overview: [],
      sections: [{ heading: 'How You Love', body: 'You connect through empathy.' }],
    });
    expect(screen.getByText(/your celestial dossier/i)).toBeTruthy();
    expect(screen.getByText(/how you love/i)).toBeTruthy();
  });
});
