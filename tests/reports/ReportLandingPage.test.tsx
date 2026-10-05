/** @jest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react';
import ReportLandingPage from '@/components/reports/ReportLandingPage';
import { REPORT_LANDING_CONTENT } from '@/lib/reportLandingPages';

jest.mock('next/navigation', () => ({
  usePathname: () => '/reports/test',
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => <a href={href} {...props}>{children}</a>,
}));

describe('report product landing pages', () => {
  afterEach(() => cleanup());

  it.each([
    ['natalpremium', 'Premium Natal Report', 39],
    ['transit', 'Yearly Transit Forecast', 49],
    ['vocation', 'Vocation & Wealth Map', 55],
  ] as const)('renders %s with its selected-product CTA and verified price', (type, name, price) => {
    render(<ReportLandingPage content={REPORT_LANDING_CONTENT[type]} price={price} />);
    expect(screen.getAllByText(name).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: new RegExp(`Choose ${name}.*\\$${price}`, 'i') }).getAttribute('href')).toBe(`/reports?product=${type}`);
    expect(screen.getByRole('link', { name: new RegExp(`Continue with ${name}.*\\$${price}`, 'i') }).getAttribute('href')).toBe(`/reports?product=${type}`);
    expect(screen.queryByText(/quality-gated|deterministic|editorial handoff|primary intent|unverified/i)).toBeNull();
  });
});
