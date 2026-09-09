import SharedReportPage from '@/app/reports/shared/[token]/page';

const getReadingByShareToken = jest.fn();
const notFound = jest.fn(() => { throw new Error('NEXT_NOT_FOUND'); });

jest.mock('@/lib/profile/store', () => ({
  getReadingByShareToken: (...args: unknown[]) => getReadingByShareToken(...args),
  toPublicReport: (record: any) => ({ ...record, status: record.pipelineStatus, pending: record.pipelineStatus !== 'approved', overview: [], sections: [] }),
}));
jest.mock('next/navigation', () => ({ notFound: () => notFound() }));

describe('shared report SSR delivery gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not SSR-render a queued report merely because it has a valid share token', async () => {
    getReadingByShareToken.mockResolvedValue({
      id: 42,
      type: 'report',
      title: 'Premium Natal Report',
      pipelineStatus: 'queued',
      pricePaid: 39,
      result: { reportType: 'natalpremium', pipeline: { status: 'queued', sections: [{ id: 'secret', prose: 'Not deliverable' }] } },
    });

    await expect(SharedReportPage({ params: Promise.resolve({ token: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' }) })).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalledTimes(1);
  });
});
