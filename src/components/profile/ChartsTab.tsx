'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface BirthChart {
  chartId: number;
  birthInfo: {
    date: string;
    time: string;
    location: string;
    latitude: number;
    longitude: number;
  };
}

export default function ChartsTab() {
  const [chart, setChart] = useState<BirthChart | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/birth-chart');
        if (res.ok) {
          const data = await res.json();
          if (data.hasChart) {
            setChart({ chartId: data.chartId, birthInfo: data.birthInfo });
          }
        }
      } catch {}
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <div className="text-center text-cosmic-300 py-12">Loading…</div>;
  }

  if (!chart) {
    return (
      <div className="glass-panel glow-border rounded-2xl p-12 text-center">
        <i className="fa-solid fa-chart-pie text-6xl text-gold mb-6"></i>
        <h3 className="font-serif text-2xl font-bold text-gold mb-3">No Birth Chart Yet</h3>
        <p className="text-cosmic-200 mb-6">
          Your birth chart is the cosmic blueprint of who you are. Create yours to unlock personalized insights.
        </p>
        <Link
          href="/birth-chart"
          className="inline-block bg-gradient-to-r from-cosmic-primary to-cosmic-secondary text-white px-8 py-3 rounded-full uppercase tracking-widest text-sm font-semibold hover:opacity-90 transition"
        >
          Create Your Chart
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="glass-panel glow-border rounded-2xl p-6">
        <h3 className="font-serif text-2xl font-bold text-gold mb-4">Your Birth Chart</h3>
        <div className="space-y-3 text-cosmic-100">
          <div className="flex items-center gap-3">
            <i className="fa-solid fa-calendar text-gold w-6"></i>
            <span>{chart.birthInfo.date}</span>
          </div>
          <div className="flex items-center gap-3">
            <i className="fa-solid fa-clock text-gold w-6"></i>
            <span>{chart.birthInfo.time}</span>
          </div>
          <div className="flex items-center gap-3">
            <i className="fa-solid fa-location-dot text-gold w-6"></i>
            <span>{chart.birthInfo.location}</span>
          </div>
        </div>
        <Link
          href="/my-chart"
          className="mt-6 inline-block bg-gradient-to-r from-cosmic-primary to-cosmic-secondary text-white px-6 py-2.5 rounded-full uppercase tracking-widest text-sm font-semibold hover:opacity-90 transition"
        >
          View Full Chart
        </Link>
      </div>
    </div>
  );
}
