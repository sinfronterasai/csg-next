'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface PatternsData {
  eligible: boolean;
  totalReadings: number;
  recurringCards: Array<{
    card: string;
    count: number;
    reversedCount: number;
    firstSeen: string;
    lastSeen: string;
    categories: string[];
  }>;
  recurringThemes: Array<{ theme: string; count: number }>;
  signResonance: Array<{ sign: string; appearances: number }>;
  elementBalance: Record<string, number>;
  timingClusters: Array<{ window: string; detail: string; count: number }>;
  reportMotifs: Array<{ motif: string; count: number }>;
  reflectionPromptFor: (card: string) => string | null;
}

export default function PatternsTab() {
  const [patterns, setPatterns] = useState<PatternsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<'upgrade' | 'auth' | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/profile/patterns');
        if (res.ok) {
          const data = await res.json();
          setPatterns(data.patterns);
        } else if (res.status === 403) {
          const data = await res.json();
          setError('upgrade');
          setMessage(data.message || 'Upgrade to Cosmic Pass to reveal patterns.');
        } else if (res.status === 401) {
          setError('auth');
        }
      } catch {}
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <div className="text-center text-cosmic-300 py-12">Loading…</div>;
  }

  if (error === 'auth') {
    return (
      <div className="glass-panel glow-border rounded-2xl p-12 text-center">
        <i className="fa-solid fa-lock text-6xl text-gold mb-6"></i>
        <h3 className="font-serif text-2xl font-bold text-gold mb-3">Sign In Required</h3>
        <p className="text-cosmic-200 mb-6">Please sign in to view your patterns.</p>
        <Link
          href="/login"
          className="inline-block bg-gradient-to-r from-cosmic-primary to-cosmic-secondary text-white px-8 py-3 rounded-full uppercase tracking-widest text-sm font-semibold hover:opacity-90 transition"
        >
          Sign In
        </Link>
      </div>
    );
  }

  if (error === 'upgrade') {
    return (
      <div className="glass-panel glow-border rounded-2xl p-12 text-center">
        <i className="fa-solid fa-crown text-6xl text-gold mb-6"></i>
        <h3 className="font-serif text-2xl font-bold text-gold mb-3">Cosmic Pass Required</h3>
        <p className="text-cosmic-200 mb-6">{message}</p>
        <Link
          href="/tarot/pricing"
          className="inline-block bg-gradient-to-r from-cosmic-primary to-cosmic-secondary text-white px-8 py-3 rounded-full uppercase tracking-widest text-sm font-semibold hover:opacity-90 transition"
        >
          Upgrade Now
        </Link>
      </div>
    );
  }

  if (!patterns || !patterns.eligible) {
    return (
      <div className="glass-panel glow-border rounded-2xl p-12 text-center">
        <i className="fa-solid fa-chart-line text-6xl text-gold mb-6"></i>
        <h3 className="font-serif text-2xl font-bold text-gold mb-3">Not Enough Data Yet</h3>
        <p className="text-cosmic-200">
          Log more readings to reveal patterns. You need at least 3 readings to unlock insights.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="font-serif text-3xl font-bold text-gold glow-text-gold">Your Patterns</h2>
        <p className="text-cosmic-200 mt-2">
          Insights from {patterns.totalReadings} readings — framed as reflection, never prediction.
        </p>
      </div>

      {patterns.recurringCards.length > 0 && (
        <PatternSection title="Recurring Cards" icon="fa-layer-group">
          <div className="grid md:grid-cols-2 gap-4">
            {patterns.recurringCards.map((c) => (
              <div key={c.card} className="glass-panel rounded-xl p-5">
                <h4 className="font-serif text-lg font-semibold text-gold mb-2">{c.card}</h4>
                <div className="space-y-1 text-sm text-cosmic-200">
                  <p>
                    <span className="text-gold">Drawn:</span> {c.count} times
                    {c.reversedCount > 0 && ` (${c.reversedCount} reversed)`}
                  </p>
                  <p>
                    <span className="text-gold">First seen:</span>{' '}
                    {new Date(c.firstSeen).toLocaleDateString()}
                  </p>
                  <p>
                    <span className="text-gold">Last seen:</span>{' '}
                    {new Date(c.lastSeen).toLocaleDateString()}
                  </p>
                  {c.categories.length > 0 && (
                    <p>
                      <span className="text-gold">Themes:</span> {c.categories.join(', ')}
                    </p>
                  )}
                </div>
                {patterns.reflectionPromptFor(c.card) && (
                  <p className="mt-3 text-sm text-cosmic-300 italic border-l-2 border-gold/30 pl-3">
                    {patterns.reflectionPromptFor(c.card)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </PatternSection>
      )}

      {patterns.recurringThemes.length > 0 && (
        <PatternSection title="Recurring Themes" icon="fa-tags">
          <div className="flex flex-wrap gap-2">
            {patterns.recurringThemes.map((t) => (
              <span
                key={t.theme}
                className="rounded-full border border-gold/30 px-4 py-1.5 text-sm text-cosmic-100"
              >
                {t.theme} <span className="text-gold ml-1">({t.count})</span>
              </span>
            ))}
          </div>
        </PatternSection>
      )}

      {patterns.signResonance.length > 0 && (
        <PatternSection title="Sign Resonance" icon="fa-star">
          <div className="grid md:grid-cols-2 gap-4">
            {patterns.signResonance.map((s) => (
              <div key={s.sign} className="glass-panel rounded-xl p-4 flex items-center justify-between">
                <span className="font-serif text-lg text-gold">{s.sign}</span>
                <span className="text-cosmic-200">{s.appearances} appearances</span>
              </div>
            ))}
          </div>
        </PatternSection>
      )}

      {Object.values(patterns.elementBalance).some((v) => v > 0) && (
        <PatternSection title="Element Balance" icon="fa-fire">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(patterns.elementBalance).map(([element, count]) => (
              <div key={element} className="glass-panel rounded-xl p-4 text-center">
                <p className="font-serif text-lg text-gold">{element}</p>
                <p className="text-2xl font-bold text-cosmic-100 mt-1">{count}</p>
              </div>
            ))}
          </div>
        </PatternSection>
      )}

      {patterns.timingClusters.length > 0 && (
        <PatternSection title="Timing Clusters" icon="fa-clock">
          <div className="space-y-3">
            {patterns.timingClusters.map((t) => (
              <div key={t.detail} className="glass-panel rounded-xl p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-serif text-lg text-gold">{t.detail}</span>
                  <span className="text-cosmic-200">{t.count} readings</span>
                </div>
                <p className="text-sm text-cosmic-300">{t.window}</p>
              </div>
            ))}
          </div>
        </PatternSection>
      )}

      {patterns.reportMotifs.length > 0 && (
        <PatternSection title="Report Motifs" icon="fa-file-lines">
          <div className="flex flex-wrap gap-2">
            {patterns.reportMotifs.map((m) => (
              <span
                key={m.motif}
                className="rounded-full border border-gold/30 px-4 py-1.5 text-sm text-cosmic-100"
              >
                {m.motif} <span className="text-gold ml-1">({m.count})</span>
              </span>
            ))}
          </div>
        </PatternSection>
      )}
    </div>
  );
}

function PatternSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass-panel glow-border rounded-2xl p-6">
      <h3 className="font-serif text-xl font-bold text-gold mb-4">
        <i className={`fa-solid ${icon} mr-2`}></i>
        {title}
      </h3>
      {children}
    </div>
  );
}
