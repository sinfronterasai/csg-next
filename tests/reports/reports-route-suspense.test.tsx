/** @jest-environment jsdom */
import { readFileSync } from 'node:fs';
import { cleanup, render, screen } from '@testing-library/react';
import ReportsPage from '@/app/reports/page';
import { getProduct } from '@/lib/productCatalog';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

describe('reports route production loading contract', () => {
  afterEach(() => cleanup());

  it('does not define a route Suspense loading fallback', () => {
    const source = readFileSync('src/app/reports/page.tsx', 'utf8');

    expect(source).not.toContain('Loading reports…');
    expect(source).not.toMatch(/<Suspense\b/);
  });

  it('does not leave the route-level Loading reports fallback visible', async () => {
    render(<ReportsPage />);

    expect(await screen.findByText(getProduct('natalpremium').displayName)).toBeTruthy();
    expect(screen.queryByText('Loading reports…')).toBeNull();
    expect(screen.getByText(getProduct('loveblueprint').displayName)).toBeTruthy();
    expect(screen.getByText(getProduct('transit').displayName)).toBeTruthy();
    expect(screen.getByText(getProduct('vocation').displayName)).toBeTruthy();
  });
});