'use client';

import { useEffect, useState } from 'react';

interface Horoscope {
  id: number;
  title: string | null;
  scope: string | null;
  createdAt: string;
  reflection: string | null;
}

export default function HoroscopeLogTab() {
  const [horoscopes, setHoroscopes] = useState<Horoscope[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [reflection, setReflection] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  useEffect(() => {
    loadHoroscopes();
  }, []);

  async function loadHoroscopes() {
    setError(false);
    try {
      const res = await fetch('/api/profile/horoscope');
      if (res.ok) {
        const data = await res.json();
        setHoroscopes(data.horoscopes || []);
      } else {
        // 401/500 etc. are failures, not "no data".
        setError(true);
      }
    } catch {
      setError(true);
    }
    setLoading(false);
  }

  async function saveReflection(id: number) {
    setSaving(true);
    setSaveErr(null);
    try {
      const res = await fetch('/api/profile/reflection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, reflection }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSaveErr(data.error || 'Could not save reflection.');
        return; // keep editor open; do not apply optimistic update
      }
      const data = await res.json();
      setHoroscopes((prev) =>
        prev.map((h) => (h.id === id ? { ...h, reflection: data.reflection ?? reflection } : h)),
      );
      setEditing(null);
    } catch {
      setSaveErr('Could not save reflection.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-center text-cosmic-300 py-12">Loading…</div>;

  if (error) return (
    <div className="glass-panel glow-border rounded-2xl p-12 text-center">
      <i className="fa-solid fa-triangle-exclamation text-6xl text-gold mb-6"></i>
      <h3 className="font-serif text-2xl font-bold text-gold mb-3">Couldn’t Load Horoscopes</h3>
      <p className="text-cosmic-200 mb-6">Something went wrong fetching your journal.</p>
      <button onClick={loadHoroscopes} className="inline-block bg-gradient-to-r from-cosmic-primary to-cosmic-secondary text-white px-8 py-3 rounded-full uppercase tracking-widest text-sm font-semibold hover:opacity-90 transition">Retry</button>
    </div>
  );

  if (horoscopes.length === 0) return (
    <div className="glass-panel glow-border rounded-2xl p-12 text-center">
      <i className="fa-solid fa-star text-6xl text-gold mb-6"></i>
      <h3 className="font-serif text-2xl font-bold text-gold mb-3">No Horoscopes Yet</h3>
      <p className="text-cosmic-200">Your daily and weekly horoscopes will appear here. Journal your reflections to track patterns.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {saveErr && <p className="text-red-400 text-sm text-center">{saveErr}</p>}
      {horoscopes.map((h) => (
        <div key={h.id} className="glass-panel glow-border rounded-2xl p-6">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h4 className="font-serif text-lg font-semibold text-gold">{h.title || 'Horoscope'}</h4>
              {h.scope && <p className="text-xs uppercase tracking-widest text-cosmic-300 mt-1">{h.scope}</p>}
              <p className="text-sm text-cosmic-300 mt-1">{new Date(h.createdAt).toLocaleDateString()}</p>
            </div>
            <button onClick={() => { setEditing(h.id); setReflection(h.reflection || ''); }} className="text-gold hover:text-cosmic-100 transition">
              <i className="fa-solid fa-pen text-sm"></i>
            </button>
          </div>
          {editing === h.id ? (
            <div className="mt-4">
              <textarea
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                rows={4}
                placeholder="What resonated with this horoscope? How did it show up in your day?"
                className="w-full rounded-lg bg-cosmic-950/80 border border-cosmic-700 p-3 text-cosmic-100 placeholder-cosmic-500 focus:border-gold focus:outline-none"
              />
              <div className="mt-3 flex gap-3">
                <button onClick={() => saveReflection(h.id)} disabled={saving} className="rounded-lg bg-gold/90 px-4 py-2 text-sm font-medium text-cosmic-950 hover:bg-gold disabled:opacity-50">Save</button>
                <button onClick={() => setEditing(null)} className="rounded-lg border border-cosmic-700 px-4 py-2 text-sm text-cosmic-300 hover:border-gold hover:text-gold">Cancel</button>
              </div>
            </div>
          ) : (
            h.reflection && <p className="mt-3 text-cosmic-100/90 leading-relaxed whitespace-pre-line">{h.reflection}</p>
          )}
        </div>
      ))}
    </div>
  );
}
