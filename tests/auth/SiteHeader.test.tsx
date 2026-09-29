/** @jest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SiteHeader from '@/components/SiteHeader';

const push = jest.fn();
const refresh = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}));

function authResponse(user: unknown, ok = true) {
  return { ok, json: () => Promise.resolve({ user }) } as unknown as Response;
}

function mockFetch(user: unknown) {
  global.fetch = jest.fn(() => Promise.resolve(authResponse(user)));
}

afterEach(() => {
  jest.restoreAllMocks();
  push.mockReset();
  refresh.mockReset();
});

describe('SiteHeader authentication state', () => {
  it('shows anonymous controls when the canonical user endpoint returns user=null', async () => {
    mockFetch(null);
    render(<SiteHeader />);

    expect(screen.getByText('…')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Login')).toBeInTheDocument());
    expect(screen.getByText('Sign Up')).toBeInTheDocument();
    expect(screen.queryByText('My Profile')).not.toBeInTheDocument();
    expect(screen.queryByText('Sign Out')).not.toBeInTheDocument();
  });

  it('shows authenticated controls when the canonical user endpoint returns a user', async () => {
    mockFetch({ role: 'user' });
    render(<SiteHeader />);

    await waitFor(() => expect(screen.getByText('My Profile')).toBeInTheDocument());
    expect(screen.getByText('Sign Out')).toBeInTheDocument();
    expect(screen.queryByText('Login')).not.toBeInTheDocument();
    expect(screen.queryByText('Sign Up')).not.toBeInTheDocument();
  });

  it('keeps anonymous controls during the unknown/loading state', () => {
    global.fetch = jest.fn(() => new Promise<Response>(() => {}));
    render(<SiteHeader />);

    expect(screen.getByText('…')).toBeInTheDocument();
    expect(screen.queryByText('My Profile')).not.toBeInTheDocument();
    expect(screen.queryByText('Login')).not.toBeInTheDocument();
    expect(screen.queryByText('Sign Out')).not.toBeInTheDocument();
  });

  it('converges to anonymous controls after logout', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(authResponse({ role: 'user' }))
      .mockResolvedValueOnce(authResponse(null));
    render(<SiteHeader />);

    await waitFor(() => expect(screen.getByText('Sign Out')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Sign Out'));

    await waitFor(() => expect(screen.getByText('Login')).toBeInTheDocument());
    expect(screen.getByText('Sign Up')).toBeInTheDocument();
    expect(screen.queryByText('My Profile')).not.toBeInTheDocument();
    expect(push).toHaveBeenCalledWith('/');
    expect(refresh).toHaveBeenCalled();
  });

  it('uses the same authentication truth in the mobile menu', async () => {
    mockFetch(null);
    render(<SiteHeader />);

    await waitFor(() => expect(screen.getByText('Login')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '' }));
    expect(screen.getAllByText('Login').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryAllByText('My Profile')).toHaveLength(0);
  });
});