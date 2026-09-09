import { PDFDocument } from 'pdf-lib';
import { GET } from '@/app/api/reports/[id]/pdf/route';
import { referenceFacts, referenceInput } from './fixtures/premiumNatalReference';

let authToken: string | undefined = 'token';
let reading: any;

jest.mock('next/headers', () => ({
  cookies: jest.fn(async () => ({ get: (key: string) => key === 'auth_token' && authToken ? { value: authToken } : undefined })),
}));
jest.mock('@/lib/auth', () => ({
  verifyToken: (token: string) => token === 'token' ? { userId: '7' } : null,
  getUserById: async (id: string) => id === '7' ? { id: 7 } : null,
}));
jest.mock('@/lib/profile/store', () => ({ getReadingById: jest.fn(async () => reading) }));

const approvedReading = () => ({
  id: 42,
  type: 'report',
  title: referenceInput.title,
  pricePaid: 4900,
  pipelineStatus: 'approved',
  result: {
    title: referenceInput.title,
    reportType: 'natalpremium',
    pipeline: { status: 'approved', sections: referenceInput.sections.map((section, index) => ({ id: `section-${index}`, prose: section.body })) },
    metadata: {
      birthData: { firstName: referenceInput.name, dob: referenceInput.birth.date, birthTime: referenceInput.birth.time, place: referenceInput.birth.location },
      verifiedFacts: {
        facts: referenceFacts,
        common: {
          houses: referenceInput.ledger!.houses,
          aspects: referenceInput.ledger!.aspects,
          elements: { value: referenceInput.ledger!.elements },
          modalities: { value: referenceInput.ledger!.modalities },
        },
      },
    },
  },
});

const call = () => GET(new Request('http://localhost/api/reports/42/pdf'), { params: Promise.resolve({ id: '42' }) });

describe('paid natal PDF delivery endpoint', () => {
  beforeEach(() => { authToken = 'token'; reading = approvedReading(); });

  it('requires an authenticated owner', async () => {
    authToken = undefined;
    const response = await call();
    expect(response.status).toBe(401);
    expect(response.headers.get('content-type')).toMatch(/application\/json/);
  });

  it('does not deliver unpaid or unapproved reports', async () => {
    reading = { ...approvedReading(), pricePaid: 0 };
    expect((await call()).status).toBe(404);
    reading = approvedReading();
    reading.result.pipeline.status = 'needs_editor';
    expect((await call()).status).toBe(404);
  });

  it('returns the exact ten-page PDF with private download headers', async () => {
    const response = await call();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('content-disposition')).toBe('attachment; filename="cosmic-spirit-guide-natal-42.pdf"');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    const parsed = await PDFDocument.load(new Uint8Array(await response.arrayBuffer()), { updateMetadata: false, throwOnInvalidObject: true });
    expect(parsed.getPageCount()).toBe(10);
  });
});
