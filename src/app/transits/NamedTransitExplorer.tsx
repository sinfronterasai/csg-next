'use client';

import { FormEvent, useState } from 'react';
import type { NamedTransitResult } from '@/lib/namedTransit';

type ApiResponse = {
  assignment?: 'treatment' | 'control';
  result?: NamedTransitResult;
  error?: string;
  events?: Array<Record<string, unknown>>;
};

function recordEvents(events: Array<Record<string, unknown>> = []) {
  for (const event of events) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('csg:named-transit', { detail: event }));
      const gtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag;
      if (gtag && typeof event.name === 'string') gtag('event', event.name, event);
    }
  }
}

export default function NamedTransitExplorer() {
  const [form, setForm] = useState(() => ({
    date: '',
    time: '',
    location: '',
    fromDate: new Date().toISOString().slice(0, 10),
  }));
  const [result, setResult] = useState<NamedTransitResult | null>(null);
  const [assignment, setAssignment] = useState<ApiResponse['assignment']>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const response = await fetch('/api/transits/named', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json() as ApiResponse;
      recordEvents(data.events);
      setAssignment(data.assignment);
      if (!response.ok) throw new Error(data.error || 'The named transit could not be calculated.');
      if (data.assignment === 'control') {
        setError('You are viewing the existing transit experience for this test.');
        return;
      }
      setResult(data.result || null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The named transit could not be calculated.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section aria-labelledby="named-transit-heading" className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-6">
      <h2 id="named-transit-heading" className="text-2xl font-semibold">Named transit window</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        See deterministic Saturn square natal Moon windows. Known birth time is required; dates are calculated in UTC and tied to your saved IANA timezone.
      </p>
      <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm">Birth date
          <input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="rounded-md border bg-background px-3 py-2" />
        </label>
        <label className="grid gap-2 text-sm">Known birth time
          <input required type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className="rounded-md border bg-background px-3 py-2" />
        </label>
        <label className="grid gap-2 text-sm sm:col-span-2">Birth location
          <input required value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="City, Country" className="rounded-md border bg-background px-3 py-2" />
        </label>
        <label className="grid gap-2 text-sm">Window starts
          <input required type="date" value={form.fromDate} onChange={(e) => setForm({ ...form, fromDate: e.target.value })} className="rounded-md border bg-background px-3 py-2" />
        </label>
        <div className="flex items-end">
          <button type="submit" disabled={loading} className="w-full rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-50">
            {loading ? 'Calculating…' : 'Find my window'}
          </button>
        </div>
      </form>
      {assignment === 'control' && <p role="status" className="mt-5 text-sm text-muted-foreground">{error}</p>}
      {error && assignment !== 'control' && <p role="alert" className="mt-5 text-sm text-red-300">{error}</p>}
      {result && (
        <div className="mt-6 border-t border-white/10 pt-5" aria-live="polite">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{result.transit.label} square {result.transit.targetLabel}</p>
          <p className="mt-2 text-sm">{result.explanation}</p>
          {result.windows.length === 0 ? <p className="mt-4 text-sm">No exact window found in the selected period.</p> : (
            <ul className="mt-4 grid gap-3">
              {result.windows.map((window) => (
                <li key={window.id} className="rounded-lg border border-white/10 p-4">
                  <div className="font-medium">Exact hit: {window.exactUtc}</div>
                  <div className="mt-1 text-sm text-muted-foreground">Active window: {window.startUtc} → {window.endUtc}</div>
                  <div className="mt-1 text-sm text-muted-foreground">Phase: {window.phase} · Motion: {window.motion} · Minimum orb: {window.minimumOrbDegrees}°</div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs text-muted-foreground">Contract {result.contractVersion} · {result.calculation.ephemeris} · no AI-generated astronomical facts.</p>
        </div>
      )}
    </section>
  );
}
