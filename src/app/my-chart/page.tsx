'use client';

import BirthChartWheel from '@/components/BirthChartWheel';

export default function MyChart() {
  const demoChart = {
    planets: {
      sun: { longitude: 45, retrograde: false },
      moon: { longitude: 120, retrograde: false },
      mercury: { longitude: 78, retrograde: true },
    },
    dignities: {
      sun: 'domicile',
      moon: 'exaltation',
    },
  };

  return (
    <section className="py-24 relative z-10 constellation-map">
      <div className="max-w-7xl mx-auto px-6 lg:px-16">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs uppercase tracking-[0.4em] text-gold block mb-3">Your Saved Chart</span>
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white">My Natal Chart</h2>
          <div className="w-24 h-0.5 bg-gradient-to-r from-transparent via-gold to-transparent mx-auto mt-6"></div>
        </div>

        <div className="glass-panel p-8 md:p-12 rounded-[40px] border border-gold/20 max-w-2xl mx-auto">
          <BirthChartWheel chartData={demoChart} birthInfo={{ name: 'Demo Saved Chart', date: '1990-01-01', time: '12:00', location: 'New York, NY' }} interactive />
        </div>
      </div>
    </section>
  );
}
