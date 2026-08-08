'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type User = { id: number; email: string; firstName: string; lastName: string; role: string };

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<string>('free');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth/user');
        if (!res.ok) {
          router.push('/login');
          return;
        }
        const data = await res.json();
        setUser(data.user);
        setTier(data.user.role === 'admin' ? 'admin' : 'free');
      } catch {
        router.push('/login');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  function logout() {
    fetch('/api/auth/logout', { method: 'POST' }).finally(() => {
      router.push('/');
      router.refresh();
    });
  }

  if (loading) return <main className="min-h-screen bg-cosmic-950 px-4 pt-32 text-cosmic-200">Loading…</main>;
  if (!user) return null;

  return (
    <main className="min-h-screen bg-cosmic-950 px-4 text-cosmic-100">
      <div className="mx-auto max-w-2xl pt-20">
        <h1 className="glow-text-gold font-serif text-center text-3xl font-bold text-gold">Your Account</h1>

        <div className="mt-8 rounded-2xl border border-gold/30 bg-cosmic-900/60 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-cosmic-300">Name</p>
              <p className="text-lg">{user.firstName} {user.lastName}</p>
            </div>
            <span className="rounded-full border border-gold px-3 py-1 text-xs uppercase tracking-widest text-gold">
              {tier}
            </span>
          </div>
          <div>
            <p className="text-sm text-cosmic-300">Email</p>
            <p className="text-lg">{user.email}</p>
          </div>

          {tier === 'free' && (
            <a href="/tarot/pricing"
              className="block rounded-full border border-gold bg-gradient-to-r from-cosmic-primary to-cosmic-secondary py-2.5 text-center text-sm font-semibold uppercase tracking-widest text-white transition hover:opacity-90">
              Upgrade to Premium
            </a>
          )}

          <button onClick={logout}
            className="w-full rounded-full border border-cosmic-700 py-2.5 text-sm uppercase tracking-widest text-cosmic-300 transition hover:border-gold hover:text-gold">
            Sign Out
          </button>
        </div>
      </div>
    </main>
  );
}
