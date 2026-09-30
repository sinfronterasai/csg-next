'use client';

import { useEffect, useState } from 'react';

export default function ResetPasswordPage() {
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get('token') || '');
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!token) {
      setError('This password reset link is invalid or has expired.');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmation) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Unable to reset password.');
      } else {
        setSuccess(true);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-cosmic-950 px-4 text-cosmic-100">
      <div className="mx-auto max-w-md pt-20">
        <h1 className="glow-text-gold font-serif text-center text-3xl font-bold text-gold">Reset Your Password</h1>
        <p className="mt-2 text-center text-cosmic-200/80">Choose a new password for your Cosmic Spirit Guide account.</p>

        {success ? (
          <div className="mt-8 rounded-2xl border border-gold/30 bg-cosmic-900/60 p-6 text-center">
            <p className="text-green-300">Your password has been reset successfully.</p>
            <a href="/login" className="mt-5 inline-block text-gold underline-offset-4 hover:underline">Return to Login</a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-4 rounded-2xl border border-gold/30 bg-cosmic-900/60 p-6">
            <div>
              <label htmlFor="new-password" className="block text-sm text-cosmic-300">New password</label>
              <input
                id="new-password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="mt-1 w-full rounded-lg border border-cosmic-700 bg-cosmic-950 px-3 py-2 text-cosmic-100 outline-none focus:border-gold"
              />
            </div>
            <div>
              <label htmlFor="confirm-password" className="block text-sm text-cosmic-300">Confirm new password</label>
              <input
                id="confirm-password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                className="mt-1 w-full rounded-lg border border-cosmic-700 bg-cosmic-950 px-3 py-2 text-cosmic-100 outline-none focus:border-gold"
              />
            </div>
            {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full border border-gold bg-gradient-to-r from-cosmic-primary to-cosmic-secondary py-2.5 text-sm font-semibold uppercase tracking-widest text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Resetting…' : 'Reset Password'}
            </button>
          </form>
        )}

        {!success && (
          <p className="mt-6 text-center text-sm text-cosmic-300">
            <a href="/login" className="text-gold underline-offset-4 hover:underline">Back to Login</a>
          </p>
        )}
      </div>
    </main>
  );
}
