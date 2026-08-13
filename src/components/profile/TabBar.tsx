'use client';

import { type ReactNode } from 'react';

export type TabId = 'overview' | 'charts' | 'reports' | 'tarot' | 'horoscope' | 'patterns' | 'settings';

interface Tab {
  id: TabId;
  label: string;
  icon: string;
}

const TABS: Tab[] = [
  { id: 'overview', label: 'Overview', icon: 'fa-compass' },
  { id: 'charts', label: 'Charts', icon: 'fa-chart-pie' },
  { id: 'reports', label: 'Reports', icon: 'fa-file-lines' },
  { id: 'tarot', label: 'Tarot Journal', icon: 'fa-layer-group' },
  { id: 'horoscope', label: 'Horoscope Log', icon: 'fa-star' },
  { id: 'patterns', label: 'Patterns', icon: 'fa-chart-line' },
  { id: 'settings', label: 'Settings', icon: 'fa-gear' },
];

interface TabBarProps {
  active: TabId;
  onChange: (id: TabId) => void;
}

export default function TabBar({ active, onChange }: TabBarProps) {
  return (
    <>
      {/* Desktop: horizontal row */}
      <div className="hidden md:flex items-center justify-center gap-2 mb-8">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`px-5 py-2.5 rounded-full text-xs uppercase tracking-widest transition-all duration-300 ${
              active === tab.id
                ? 'bg-gradient-to-r from-cosmic-primary to-cosmic-secondary text-white shadow-lg shadow-cosmic-primary/30'
                : 'border border-gold/30 text-gold hover:border-gold hover:bg-gold/10'
            }`}
          >
            <i className={`fa-solid ${tab.icon} mr-2`}></i>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Mobile: scrollable pill row */}
      <div className="md:hidden overflow-x-auto mb-6 -mx-4 px-4">
        <div className="flex gap-2 min-w-max pb-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`px-4 py-2 rounded-full text-xs uppercase tracking-widest whitespace-nowrap transition-all duration-300 ${
                active === tab.id
                  ? 'bg-gradient-to-r from-cosmic-primary to-cosmic-secondary text-white'
                  : 'border border-gold/30 text-gold'
              }`}
            >
              <i className={`fa-solid ${tab.icon} mr-1.5`}></i>
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
