/** @jest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react';
import { getProduct } from '@/lib/productCatalog';
import ReportsPage from '@/app/reports/page';
import ReportsView from '@/app/reports/ReportsView';

const pendingSearchParams = new Promise<never>(() => undefined);

jest.mock('next/navigation', () => ({
  useSearchParams: () => { throw pendingSearchParams; },
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

jest.mock('@/lib/whopCatalog', () => ({ WHOP_CHECKOUT_URLS: {} }));

const authResponse = (body: unknown, status = 200) =>
  Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => body } as Response);

describe('public reports catalog loading contract', () => {
  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  it('renders the public catalog instead of suspending forever on anonymous auth', async () => {
    global.fetch = jest.fn().mockResolvedValue(authResponse({ user: null })) as unknown as typeof fetch;

    render(<ReportsPage />);

    expect(await screen.findByText(getProduct('natalpremium').displayName)).toBeTruthy();
    expect(screen.getAllByText(getProduct('natalpremium').formattedPrice, { exact: false }).length).toBeGreaterThan(0);
    expect(screen.getByText(getProduct('loveblueprint').displayName)).toBeTruthy();
    expect(screen.getAllByText(getProduct('loveblueprint').formattedPrice, { exact: false }).length).toBeGreaterThan(0);
    expect(screen.getByText(getProduct('transit').displayName)).toBeTruthy();
    expect(screen.getAllByText(getProduct('transit').formattedPrice, { exact: false }).length).toBeGreaterThan(0);
    expect(screen.getByText(getProduct('vocation').displayName)).toBeTruthy();
    expect(screen.getAllByText(getProduct('vocation').formattedPrice, { exact: false }).length).toBeGreaterThan(0);
  });

  it('renders the same public catalog for an authenticated visitor', () => {
    global.fetch = jest.fn().mockResolvedValue(authResponse({ user: { id: 7, email: 'fixture@example.com' } })) as unknown as typeof fetch;

    render(<ReportsView />);

    expect(screen.getByText(getProduct('natalpremium').displayName)).toBeTruthy();
    expect(screen.getByText(getProduct('loveblueprint').displayName)).toBeTruthy();
    expect(screen.getByText(getProduct('transit').displayName)).toBeTruthy();
    expect(screen.getByText(getProduct('vocation').displayName)).toBeTruthy();
  });

  it('does not make an auth lookup failure create a permanent loading state', () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('auth unavailable')) as unknown as typeof fetch;

    render(<ReportsView />);

    expect(screen.queryByText('Loading reports…')).toBeNull();
    expect(screen.getByText(getProduct('natalpremium').displayName)).toBeTruthy();
    expect(screen.getByText(getProduct('vocation').displayName)).toBeTruthy();
  });
});
