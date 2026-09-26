'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import type { ToolDefinition } from '@/lib/tools/registry';

type GtagWindow = Window & { gtag?: (...args: unknown[]) => void };

function track(name: string, parameters: Record<string, string>): void {
  if (typeof window === 'undefined') return;
  const gtag = (window as GtagWindow).gtag;
  if (gtag) gtag('event', name, parameters);
}

export default function ToolsHub({ tools }: { tools: ToolDefinition[] }) {
  useEffect(() => {
    track('tools_hub_view', { tool_count: String(tools.length) });
  }, [tools.length]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-12 lg:px-10">
      <nav aria-label="Breadcrumb" className="text-sm text-gray-400">
        <Link href="/" className="hover:text-gold">Home</Link> <span aria-hidden="true">/</span> <span>Tools</span>
      </nav>
      <div className="mt-8 max-w-3xl">
        <p className="text-xs uppercase tracking-[0.3em] text-gold">Cosmic Spirit Guide tools</p>
        <h1 className="mt-3 font-serif text-4xl tracking-wide text-white md:text-5xl">Find the right doorway into your chart</h1>
        <p className="mt-5 text-lg leading-8 text-gray-300">
          Use these focused experiences to explore your sky, your patterns, and the timing that is most useful to you now.
        </p>
      </div>
      <section aria-labelledby="tools-list-heading" className="mt-12">
        <h2 id="tools-list-heading" className="sr-only">Available tools</h2>
        <div className="grid gap-6 md:grid-cols-2">
          {tools.map((tool) => {
            const limited = tool.availability === 'limited-rollout';
            return (
              <article key={tool.id} className={`glass-panel rounded-3xl border p-7 ${tool.featured ? 'border-gold/50 shadow-[0_0_35px_rgba(234,179,8,0.12)]' : 'border-white/10'}`}>
                <div className="flex items-start justify-between gap-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-gold">{tool.featured ? 'Featured tool' : 'Interactive tool'}</p>
                  {limited && <span className="rounded-full border border-white/15 px-3 py-1 text-[10px] uppercase tracking-widest text-gray-400">Limited rollout</span>}
                </div>
                <h3 className="mt-5 font-serif text-2xl text-white">{tool.name}</h3>
                <p className="mt-3 min-h-20 text-sm leading-7 text-gray-300">{tool.description}</p>
                {limited && <p className="mt-4 text-xs leading-5 text-gray-400">This personalized experience is currently available only when the R-016 rollout is enabled. The transit hub remains available for everyone.</p>}
                <Link
                  href={tool.href}
                  onClick={() => track('tool_selected', { tool_id: tool.id, tool_name: tool.name })}
                  className="mt-7 inline-flex items-center rounded-full border border-gold px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-gold transition hover:bg-gold hover:text-cosmic-950"
                >
                  {tool.cta} <span aria-hidden="true" className="ml-3">→</span>
                </Link>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
