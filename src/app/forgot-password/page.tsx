'use client';

import { useState } from 'react';

const GENERIC_MESSAGE = "If an account exists for that email, we've sent password reset instructions.";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setLoading(true);
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Unable to submit the request.');
      } else {
        setMessage(data.message || GENERIC_MESSAGE);
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
        <h1 className="glow-text-gold font-serif text-center text-3xl font-bold text-gold">Forgot Password?</h1>
        <p className="mt-2 text-center text-cosmic-200/80">Enter your email and we’ll send reset instructions if an account exists.</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4 rounded-2xl border border-gold/30 bg-cosmic-900/60 p-6">
          <div>
            <label htmlFor="forgot-email" className="block text-sm text-cosmic-300">Email</label>
            <input
              id="forgot-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-lg border border-cosmic-700 bg-cosmic-950 px-3 py-2 text-cosmic-100 outline-none focus:border-gold"
            />
          </div>
          {message && <p role="status" className="text-sm text-green-300">{message}</p>}
          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full border border-gold bg-gradient-to-r from-cosmic-primary to-cosmic-secondary py-2.5 text-sm font-semibold uppercase tracking-widest text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Sending…' : 'Send Reset Instructions'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-cosmic-300">
          <a href="/login" className="text-gold underline-offset-4 hover:underline">Back to Login</a>
        </p>
      </div>
    </main>
  );
}
