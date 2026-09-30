import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import LoginPage from '@/app/login/page';
import ForgotPasswordPage from '@/app/forgot-password/page';
import ResetPasswordPage from '@/app/reset-password/page';

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }) }));

describe('password reset UI', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ message: "If an account exists for that email, we've sent password reset instructions." }) }) as unknown as typeof fetch;
  });

  it('exposes Forgot Password navigation from login', () => {
    render(<LoginPage />);
    expect(screen.getByRole('link', { name: 'Forgot Password?' }).getAttribute('href')).toBe('/forgot-password');
  });

  it('submits the forgot-password form and renders the generic confirmation', async () => {
    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'person@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send Reset Instructions' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain("If an account exists for that email, we've sent password reset instructions."));
    expect(global.fetch).toHaveBeenCalledWith('/api/auth/forgot-password', expect.objectContaining({ method: 'POST' }));
  });

  it('validates reset password confirmation and minimum length', async () => {
    window.history.pushState({}, '', '/reset-password?token=token');
    render(<ResetPasswordPage />);
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'short' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'different' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset Password' }));
    expect((await screen.findByRole('alert')).textContent).toContain('at least 8 characters');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
