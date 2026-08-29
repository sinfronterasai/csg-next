/** @jest-environment jsdom */
// Reports tab consumes the public async report contract (toPublicReport), not
// legacy result.text. Status gates both prose rendering and the PDF action.
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ReportsTab from '@/components/profile/ReportsTab';

// Capture PDF export invocations without opening real windows.
const exportSpy = jest.fn();
jest.mock('@/lib/reportPdf', () => ({
  exportReportPdf: (input: unknown) => exportSpy(input),
}));

const approvedReport = {
  id: 11,
  reportId: 'r-1',
  title: 'Natal Birth Chart Report',
  type: 'natal',
  status: 'approved',
  overview: [],
  sections: [
    { id: 'core_identity', prose: 'Approved prose body.' },
    { id: 'empty', prose: '' },
  ],
  createdAt: '2026-08-01T00:00:00Z',
};

function mockFetch(reports: unknown[]) {
  global.fetch = jest.fn(() =>
    Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ reports }) } as unknown as Response),
  );
}

afterEach(() => {
  jest.restoreAllMocks();
  exportSpy.mockClear();
});

describe('ReportsTab (async public contract)', () => {
  it('renders approved sections in order and exposes a Download PDF control', async () => {
    mockFetch([approvedReport]);
    render(<ReportsTab />);
    fireEvent.click(await screen.findByText('Natal Birth Chart Report'));
    expect(await screen.findByText('Approved prose body.')).toBeInTheDocument();
    const pdfBtn = screen.getByRole('button', { name: /download pdf|save as pdf/i });
    fireEvent.click(pdfBtn);
    await waitFor(() => expect(exportSpy).toHaveBeenCalledTimes(1));
    const arg = exportSpy.mock.calls[0][0];
    expect(arg.title).toBe('Natal Birth Chart Report');
    expect(arg.sections).toEqual([{ heading: 'Core Identity', body: 'Approved prose body.' }]);
  });

  it.each([
    ['queued', /being prepared|preparing/i],
    ['pending', /being prepared|preparing/i],
    ['needs_editor', /review|prepared|editor/i],
    ['rejected', /could not|unavailable|try again|retry|contact/i],
  ])('shows a non-deliverable message and NO PDF control for status=%s', async (status, re) => {
    mockFetch([{ ...approvedReport, status, sections: [] }]);
    render(<ReportsTab />);
    fireEvent.click(await screen.findByText('Natal Birth Chart Report'));
    expect(await screen.findByText(re)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /download pdf|save as pdf/i })).not.toBeInTheDocument();
  });

  it('does not require result.text for an approved async report', async () => {
    const noLegacy: Record<string, unknown> = { ...approvedReport };
    delete noLegacy.result;
    mockFetch([noLegacy]);
    render(<ReportsTab />);
    fireEvent.click(await screen.findByText('Natal Birth Chart Report'));
    expect(await screen.findByText('Approved prose body.')).toBeInTheDocument();
  });

  it('never renders factsCited or internal judge/rejection data', async () => {
    const withInternals = {
      ...approvedReport,
      sections: [{ id: 'core_identity', prose: 'Approved prose body.', factsCited: ['sun-in-capricorn'] }],
      judge: { score: 0.91 },
      rejectReasons: ['banned phrase'],
    };
    mockFetch([withInternals]);
    render(<ReportsTab />);
    fireEvent.click(await screen.findByText('Natal Birth Chart Report'));
    expect(await screen.findByText('Approved prose body.')).toBeInTheDocument();
    expect(screen.queryByText(/sun-in-capricorn/)).not.toBeInTheDocument();
    expect(screen.queryByText(/banned phrase/)).not.toBeInTheDocument();
  });
});
