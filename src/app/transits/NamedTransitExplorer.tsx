'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { NextTransitResult } from '@/lib/nextTransit';
import { getProduct } from '@/lib/productCatalog';

const yearlyTransitProduct = getProduct('transit');

type ApiResponse = {
  result?: NextTransitResult;
  error?: string;
  events?: Array<Record<string, unknown>>;
};

function trackEvent(name: string, parameters: Record<string, string> = {}) {
  if (typeof window === 'undefined') return;
  const event = { name, route: '/transits', ...parameters, timestamp: new Date().toISOString() };
  window.dispatchEvent(new CustomEvent('csg:next-transit', { detail: event }));
  const gtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag;
  if (gtag) gtag('event', name, event);
}

function recordEvents(events: Array<Record<string, unknown>> = []) {
  for (const event of events) {
    if (typeof event.name === 'string') {
      const parameters = Object.fromEntries(Object.entries(event).filter(([key, value]) => key !== 'name' && typeof value === 'string')) as Record<string, string>;
      trackEvent(event.name, parameters);
    }
  }
}

function formatDate(value: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: timezone, dateStyle: 'medium' }).format(new Date(value));
}

export default function NamedTransitExplorer() {
  const [form, setForm] = useState({ date: '', time: '', location: '' });
  const [result, setResult] = useState<NextTransitResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { trackEvent('next_transit_viewed'); }, []);
  useEffect(() => {
    if (result) trackEvent('yearly_forecast_cta_viewed', { report_id: 'transit' });
  }, [result]);

  const timezone = result?.searchPeriod.displayTimezone ?? 'UTC';
  const selected = result?.nextTransit;
  const activeLabel = useMemo(() => selected ? `${formatDate(selected.activeWindow.startUtc, timezone)} – ${formatDate(selected.activeWindow.endUtc, timezone)}` : '', [selected, timezone]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const response = await fetch('/api/transits/next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json() as ApiResponse;
      recordEvents(data.events);
      if (!response.ok) throw new Error(data.error || 'The next major transit could not be calculated.');
      setResult(data.result || null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The next major transit could not be calculated.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section aria-labelledby="next-transit-heading" className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-6">
      <h2 id="next-transit-heading" className="text-2xl font-semibold">YOUR NEXT MAJOR TRANSIT</h2>
      <p className="mt-2 text-sm text-muted-foreground">Discover the next major planetary transit to your birth chart and when it is strongest.</p>
      <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm">Birth Date
          <input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="rounded-md border bg-background px-3 py-2" />
        </label>
        <label className="grid gap-2 text-sm">Birth Time
          <input required type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className="rounded-md border bg-background px-3 py-2" />
        </label>
        <label className="grid gap-2 text-sm sm:col-span-2">Birth Location
          <input required value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="City, Country" className="rounded-md border bg-background px-3 py-2" />
        </label>
        <div className="flex items-end sm:col-span-2">
          <button type="submit" disabled={loading} className="w-full rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-50">
            {loading ? 'Calculating…' : 'Find My Next Transit'}
          </button>
        </div>
      </form>
      {error && <p role="alert" className="mt-5 text-sm text-red-300">{error}</p>}
      {result && (
        <div className="mt-6 border-t border-white/10 pt-5" aria-live="polite">
          {selected ? (
            <>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{selected.moverLabel} {selected.aspect} natal {selected.targetLabel}</p>
              <p className="mt-2 text-sm font-medium">{selected.status}</p>
              <p className="mt-3 text-sm">Active: {activeLabel}</p>
              <p className="mt-1 text-sm">Strongest: {formatDate(selected.strongestDate, timezone)}</p>
              <p className="mt-4 text-sm">{selected.shortInterpretation}</p>
            </>
          ) : <p className="text-sm">No qualifying major transit was found in the next 12 months.</p>}
          <div className="mt-6 rounded-xl border border-gold/30 p-4">
            <h3 className="text-lg font-semibold">YOUR YEAR IS BIGGER THAN ONE TRANSIT</h3>
            <p className="mt-2 text-sm">We found {result.significantTransitCount} significant transit periods in your next 12 months.</p>
            <p className="mt-2 text-sm text-muted-foreground">See how they overlap, when they’re strongest, and what they mean together.</p>
            <a href={yearlyTransitProduct.reportRoute} onClick={() => trackEvent('yearly_forecast_cta_clicked', { report_id: yearlyTransitProduct.id, price: String(yearlyTransitProduct.priceCents / 100) })} className="mt-4 inline-flex rounded-md bg-gold px-4 py-2 font-medium text-cosmic-950">
              See My 12-Month Transit Forecast — {yearlyTransitProduct.formattedPrice}
            </a>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Want to keep your birth details handy? <a href="/birth-chart" className="underline">Save your birth chart</a> or <a href="/login" className="underline">sign in</a>.</p>
        </div>
      )}
    </section>
  );
}
