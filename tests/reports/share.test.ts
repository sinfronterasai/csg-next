import { mintShareToken, getReadingByShareToken } from '@/lib/profile/store';

// Mock the db layer so we never touch the production database.
const mockQuery = jest.fn();
jest.mock('@/lib/db', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
}));

function fakeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 42, user_id: 7, type: 'report', title: 'Natal Birth Chart Report',
    question: null, category: null, scope: null, period_start: null, period_end: null,
    price_paid: 0, partner_label: null,
    result: JSON.stringify({ reportType: 'natal', overview: [], sections: [] }),
    reflection: null, created_at: '2026-08-17T00:00:00Z',
    share_token: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', ...overrides,
  };
}

describe('public report sharing', () => {
  beforeEach(() => mockQuery.mockReset());

  it('mintShareToken sets a uuid on the owned row and returns it', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ share_token: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' }] });
    const token = await mintShareToken(42, 7);
    expect(token).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(mockQuery.mock.calls[0][1]).toEqual([42, 7]);
  });

  it('mintShareToken returns null when the row is not owned by the user', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const token = await mintShareToken(42, 999);
    expect(token).toBeNull();
  });

  it('getReadingByShareToken returns the reading for a valid token', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [fakeRow()] });
    const rec = await getReadingByShareToken('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(rec).not.toBeNull();
    expect(rec!.id).toBe(42);
    expect(rec!.userId).toBe(7);
    expect(mockQuery.mock.calls[0][1]).toEqual(['aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee']);
  });

  it('getReadingByShareToken returns null for an unknown token', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const rec = await getReadingByShareToken('ffffffff-ffff-ffff-ffff-ffffffffffff');
    expect(rec).toBeNull();
  });

  it('SECURITY: the sequential id is never a public handle (rejected by uuid guard, no query)', async () => {
    const rec = await getReadingByShareToken('42');
    expect(rec).toBeNull();
    expect(mockQuery).not.toHaveBeenCalled();
  });
});

describe('getReadingByShareToken: invalid token handling', () => {
  beforeEach(() => mockQuery.mockReset());

  it('returns null for a non-uuid token WITHOUT querying the DB (no 500)', async () => {
    const rec = await getReadingByShareToken('none');
    expect(rec).toBeNull();
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('returns null for a uuid-shaped but absent token (clean 404, no throw)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const rec = await getReadingByShareToken('ffffffff-ffff-ffff-ffff-ffffffffffff');
    expect(rec).toBeNull();
    expect(mockQuery.mock.calls[0][1]).toEqual(['ffffffff-ffff-ffff-ffff-ffffffffffff']);
  });
});
