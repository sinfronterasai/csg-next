'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }
      router.push('/profile');
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-cosmic-950 px-4 text-cosmic-100">
      <div className="mx-auto max-w-md pt-20">
        <h1 className="glow-text-gold font-serif text-center text-3xl font-bold text-gold">Welcome Back</h1>
        <p className="mt-2 text-center text-cosmic-200/80">Sign in to your Cosmic Spirit Guide account.</p>

        <form onSubmit={handleSubmit} className="mt-8 rounded-2xl border border-gold/30 bg-cosmic-900/60 p-6 space-y-4">
          <div>
            <label className="block text-sm text-cosmic-300">Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-cosmic-700 bg-cosmic-950 px-3 py-2 text-cosmic-100 outline-none focus:border-gold" />
          </div>
          <div>
            <label className="block text-sm text-cosmic-300">Password</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-cosmic-700 bg-cosmic-950 px-3 py-2 text-cosmic-100 outline-none focus:border-gold" />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full rounded-full border border-gold bg-gradient-to-r from-cosmic-primary to-cosmic-secondary py-2.5 text-sm font-semibold uppercase tracking-widest text-white transition hover:opacity-90 disabled:opacity-50">
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-cosmic-300">
          No account?{' '}
          <a href="/signup" className="text-gold underline-offset-4 hover:underline">Create one</a>
        </p>
      </div>
    </main>
  );
}
