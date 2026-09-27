/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import TransitsHub from '@/app/transits/page';

jest.mock('@/app/transits/NamedTransitExplorer', () => ({
  __esModule: true,
  default: () => <div data-testid="named-transit-explorer">Named transit explorer</div>,
}));

describe('public transits route', () => {
  beforeEach(() => {
    delete process.env.CSG_NAMED_TRANSIT_EXPERIMENT;
    delete process.env.NEXT_PUBLIC_NAMED_TRANSIT_EXPERIMENT;
  });

  it('renders the explorer for an ordinary visitor without rollout configuration', () => {
    render(<TransitsHub />);
    expect(screen.getByTestId('named-transit-explorer')).toBeTruthy();
  });
});
