/** @jest-environment jsdom */
import React from 'react';
import { render, screen } from '@testing-library/react';

const mockGetReadingByShareToken = jest.fn();
const mockNotFound = jest.fn(() => { throw new Error('NOT_FOUND'); });

jest.mock('@/lib/profile/store', () => ({
  getReadingByShareToken: (...args: unknown[]) => mockGetReadingByShareToken(...args),
}));
jest.mock('next/navigation', () => ({ notFound: () => mockNotFound() }));
jest.mock('@/components/reports/ReportResult', () => ({
  __esModule: true,
  default: ({ title, overview, sections }: { title?: string; overview: unknown[]; sections: unknown[] }) => (
    <div data-testid="report-result" data-title={title} data-overview-count={overview.length}>
      {JSON.stringify(sections)}
    </div>
  ),
}));

import SharedReportPage from '@/app/reports/shared/[token]/page';

function approvedRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    type: 'report',
    title: 'Love Blueprint',
    pipelineStatus: 'approved',
    result: {
      title: 'Love Blueprint',
      reportType: 'loveblueprint',
      pipeline: {
        status: 'approved',
        sections: [{ id: 'howYouLove', prose: 'You connect through empathy.' }],
      },
    },
    ...overrides,
  };
}

describe('shared async report page', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders approved nested pipeline sections without requiring a synthetic overview', async () => {
    mockGetReadingByShareToken.mockResolvedValue(approvedRecord());

    const view = await SharedReportPage({ params: Promise.resolve({ token: '9b2e6b73-5c5f-4f09-b2eb-a17e64566471' }) });
    render(view);

    const result = screen.getByTestId('report-result');
    expect(result.getAttribute('data-title')).toBe('Love Blueprint');
    expect(result.getAttribute('data-overview-count')).toBe('0');
    expect(result.textContent).toContain('How You Love');
    expect(result.textContent).toContain('You connect through empathy.');
  });

  it('fails closed for a stale token whose report is not approved', async () => {
    mockGetReadingByShareToken.mockResolvedValue(approvedRecord({ pipelineStatus: 'rejected' }));

    await expect(SharedReportPage({ params: Promise.resolve({ token: '9b2e6b73-5c5f-4f09-b2eb-a17e64566471' }) }))
      .rejects.toThrow('NOT_FOUND');
  });
});
