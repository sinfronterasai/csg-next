'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface User {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
}

interface Stats {
  chartsCount: number;
  tarotCount: number;
  reportCount: number;
  horoscopeCount: number;
}

interface Props {
  user: User;
  onNavigate: (tab: string) => void;
}

export default function OverviewTab({ user, onNavigate }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [tier, setTier] = useState<'free' | 'cosmic'>('free');

  useEffect(() => {
    (async () => {
      try {
        const [statsRes, patternsRes] = await Promise.all([
          fetch('/api/profile/stats'),
          fetch('/api/profile/patterns'),
        ]);
        if (statsRes.ok) {
          const data = await statsRes.json();
          setStats(data.stats);
        }
        if (patternsRes.ok) {
          setTier('cosmic');
        } else if (patternsRes.status === 403) {
          setTier('free');
        }
      } catch {}
    })();
  }, []);

  const greeting = user.first_name || 'Cosmic traveler';

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="font-serif text-3xl font-bold text-gold glow-text-gold">
          Welcome, {greeting}
        </h2>
        <div className="mt-3 inline-flex items-center gap-2">
          {tier === 'cosmic' ? (
            <span className="rounded-full border border-gold bg-gradient-to-r from-cosmic-primary/20 to-cosmic-secondary/20 px-4 py-1 text-xs uppercase tracking-widest text-gold">
              <i className="fa-solid fa-star mr-2"></i>Cosmic Pass
            </span>
          ) : (
            <Link
              href="/tarot/pricing"
              className="rounded-full border border-gold/50 px-4 py-1 text-xs uppercase tracking-widest text-gold hover:bg-gold/10 transition"
            >
              <i className="fa-solid fa-crown mr-2"></i>Free · Upgrade
            </Link>
          )}
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon="fa-chart-pie" label="Birth Charts" count={stats.chartsCount} />
          <StatCard icon="fa-layer-group" label="Tarot Readings" count={stats.tarotCount} />
          <StatCard icon="fa-file-lines" label="Reports" count={stats.reportCount} />
          <StatCard icon="fa-star" label="Horoscopes" count={stats.horoscopeCount} />
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <QuickAction icon="fa-layer-group" label="Draw Tarot" href="/tarot" />
        <QuickAction icon="fa-chart-pie" label="My Chart" href="/my-chart" />
        <QuickAction icon="fa-file-lines" label="Reports" href="/reports" />
        <button
          onClick={() => onNavigate('horoscope')}
          className="glass-panel glow-border rounded-2xl p-6 text-center hover:border-gold transition-all duration-300 group"
        >
          <i className="fa-solid fa-star text-3xl text-gold mb-3 group-hover:scale-110 transition-transform"></i>
          <p className="text-sm uppercase tracking-widest text-cosmic-100">Horoscope Log</p>
        </button>
      </div>
    </div>
  );
}

function StatCard({ icon, label, count }: { icon: string; label: string; count: number }) {
  return (
    <div className="glass-panel glow-border rounded-2xl p-5 text-center">
      <i className={`fa-solid ${icon} text-2xl text-gold mb-2`}></i>
      <p className="text-3xl font-bold text-cosmic-100">{count}</p>
      <p className="text-xs uppercase tracking-widest text-cosmic-300 mt-1">{label}</p>
    </div>
  );
}

function QuickAction({ icon, label, href }: { icon: string; label: string; href: string }) {
  return (
    <Link
      href={href}
      className="glass-panel glow-border rounded-2xl p-6 text-center hover:border-gold transition-all duration-300 group"
    >
      <i className={`fa-solid ${icon} text-3xl text-gold mb-3 group-hover:scale-110 transition-transform`}></i>
      <p className="text-sm uppercase tracking-widest text-cosmic-100">{label}</p>
    </Link>
  );
}
