'use client';

import { useRef, useState, useCallback } from 'react';

const zodiacSymbols: Record<string, string> = {
  Aries: '♈', Taurus: '♉', Gemini: '♊', Cancer: '♋', Leo: '♌', Virgo: '♍',
  Libra: '♎', Scorpio: '♏', Sagittarius: '♐', Capricorn: '♑', Aquarius: '♒', Pisces: '♓'
};

const planetSymbols: Record<string, string> = {
  sun: '☉', moon: '☽', mercury: '☿', venus: '♀', mars: '♂', jupiter: '♃', saturn: '♄',
  uranus: '♅', neptune: '♆', pluto: '♇', northnode: '☊', southnode: '☋', chiron: '⚷', partoffortune: '⊕'
};

export default function BirthChartWheel({ chartData, birthInfo, interactive = false }: { chartData?: any; birthInfo?: any; interactive?: boolean }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [activeSegment, setActiveSegment] = useState<string | null>(null);
  const [activeHouse, setActiveHouse] = useState<string | null>(null);
  const [activePlanet, setActivePlanet] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'wheel' | 'table'>('wheel');

  const centerX = 500;
  const centerY = 400;
  const outerRadius = 350;
  const zodiacRadius = 320;
  const planetRadius = 280;
  const innerRadius = 240;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    if (dateStr.includes('-')) {
      const [year, month, day] = dateStr.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (timeStr?: string) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours % 12 || 12;
    return `${displayHour}:${String(minutes).padStart(2, '0')} ${period}`;
  };

  const toggleSegment = useCallback((sign: string) => {
    setActiveSegment((prev) => (prev === sign ? null : sign));
    setActiveHouse(null);
    setActivePlanet(null);
  }, []);

  const toggleHouse = useCallback((house: string) => {
    setActiveHouse((prev) => (prev === house ? null : house));
    setActiveSegment(null);
    setActivePlanet(null);
  }, []);

  const togglePlanet = useCallback((planet: string) => {
    setActivePlanet((prev) => (prev === planet ? null : planet));
    setActiveSegment(null);
    setActiveHouse(null);
  }, []);

  const downloadChart = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const canvas = document.createElement('canvas');
    canvas.width = 1400;
    canvas.height = 1000;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    img.onload = () => {
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, 1400, 1000);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        const link = document.createElement('a');
        link.download = `birth-chart-${birthInfo?.date || 'chart'}.png`;
        link.href = URL.createObjectURL(blob!);
        link.click();
      });
    };
    img.src = url;
  };

  const downloadSVG = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const link = document.createElement('a');
    link.download = `birth-chart-${birthInfo?.date || 'chart'}.svg`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getPointOnCircle = (radius: number, angle: number) => {
    if (typeof angle !== 'number' || Number.isNaN(angle)) {
      return { x: NaN, y: NaN };
    }
    const rad = (angle - 90) * Math.PI / 180;
    return {
      x: centerX + radius * Math.cos(rad),
      y: centerY + radius * Math.sin(rad)
    };
  };

  const renderZodiacWheel = () => {
    return Object.keys(zodiacSymbols).map((sign, index) => {
      const startAngle = index * 30;
      const midAngle = startAngle + 15;
      const point = getPointOnCircle(zodiacRadius, midAngle);
      const startPoint = getPointOnCircle(outerRadius, startAngle);
      const endPoint = getPointOnCircle(innerRadius, startAngle);
      return (
        <g key={sign} onClick={() => interactive && toggleSegment(sign)} style={{ cursor: interactive ? 'pointer' : undefined }}>
          <line x1={startPoint.x} y1={startPoint.y} x2={endPoint.x} y2={endPoint.y} stroke="rgba(196,91,122,0.85)" strokeWidth="1" opacity="0.3" />
          <text x={point.x} y={point.y} textAnchor="middle" dominantBaseline="middle" fontSize="24" fill="rgba(196,91,122,0.9)" fontWeight="bold">
            {zodiacSymbols[sign]}
          </text>
        </g>
      );
    });
  };

  const renderPlanets = () => {
    if (!chartData?.planets) return null;
    return Object.entries(chartData.planets).map(([planet, data]: [string, any]) => {
      if (!data || typeof data.longitude !== 'number' || Number.isNaN(data.longitude)) return null;
      const angle = data.longitude;
      const point = getPointOnCircle(planetRadius, angle);
      if (Number.isNaN(point.x) || Number.isNaN(point.y)) return null;
      const symbol = planetSymbols[planet.toLowerCase()] || planet[0].toUpperCase();
      const isRetrograde = data.retrograde === true;
      const isSpecialPoint = ['northnode', 'southnode', 'chiron'].includes(planet.toLowerCase());
      const dignity = chartData?.dignities?.[planet];
      let dignitySymbol = '';
      let dignityColor = '#6366f1';
      if (dignity === 'domicile') { dignitySymbol = '👑'; dignityColor = '#f59e0b'; }
      else if (dignity === 'exaltation') { dignitySymbol = '↑'; dignityColor = '#10b981'; }
      else if (dignity === 'detriment') { dignitySymbol = '↓'; dignityColor = '#f97316'; }
      else if (dignity === 'fall') { dignitySymbol = '×'; dignityColor = '#ef4444'; }

      return (
        <g key={planet} onClick={() => interactive && togglePlanet(planet)} style={{ cursor: interactive ? 'pointer' : undefined }}>
          <circle cx={point.x} cy={point.y} r="20" fill="rgba(255,255,255,0.04)" stroke={dignity ? dignityColor : (isSpecialPoint ? '#ec4899' : '#6366f1')} strokeWidth="2" />
          <text x={point.x} y={point.y} textAnchor="middle" dominantBaseline="middle" fontSize="18" fill={isSpecialPoint ? '#ec4899' : '#6366f1'} fontWeight="bold">
            {symbol}
          </text>
          {isRetrograde && (
            <text x={point.x + 18} y={point.y - 12} textAnchor="middle" fontSize="12" fill="#ef4444" fontWeight="bold">℞</text>
          )}
          {dignitySymbol && (
            <text x={point.x + 18} y={point.y + 12} textAnchor="middle" fontSize="12" fill={dignityColor}>{dignitySymbol}</text>
          )}
        </g>
      );
    });
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-2xl font-serif text-white">{birthInfo?.name || 'Chart'}</h4>
          <span className="text-xs text-gold tracking-wider uppercase">Natal Cosmic Configuration</span>
        </div>
        {interactive && (
          <div className="space-x-2">
            <button onClick={() => setViewMode('wheel')} className={`text-xs px-3 py-1 rounded-md border ${viewMode === 'wheel' ? 'bg-gold text-cosmic-950' : 'border-white/20 text-gray-300'}`}>Wheel</button>
            <button onClick={() => setViewMode('table')} className={`text-xs px-3 py-1 rounded-md border ${viewMode === 'table' ? 'bg-gold text-cosmic-950' : 'border-white/20 text-gray-300'}`}>Table</button>
            <button onClick={downloadChart} className="text-xs px-3 py-1 rounded-md border border-gold text-gold">PNG</button>
            <button onClick={downloadSVG} className="text-xs px-3 py-1 rounded-md border border-gold text-gold">SVG</button>
          </div>
        )}
      </div>

      {viewMode === 'wheel' ? (
        <svg ref={svgRef} viewBox="0 0 1000 800" className="w-full h-auto max-h-[350px] mx-auto">
          <circle cx={centerX} cy={centerY} r={outerRadius} fill="none" stroke="rgba(223,183,108,0.25)" strokeWidth="1" />
          <circle cx={centerX} cy={centerY} r={zodiacRadius} fill="none" stroke="rgba(223,183,108,0.35)" strokeWidth="1" />
          <circle cx={centerX} cy={centerY} r={planetRadius} fill="none" stroke="rgba(223,183,108,0.25)" strokeWidth="1" />
          <circle cx={centerX} cy={centerY} r={innerRadius} fill="none" stroke="rgba(223,183,108,0.2)" strokeWidth="1" />
          {renderZodiacWheel()}
          {renderPlanets()}
        </svg>
      ) : (
        <div className="space-y-3 text-sm text-gray-300">
          {chartData?.planets && Object.entries(chartData.planets).map(([planet, data]: [string, any]) => {
            const symbol = planetSymbols[planet.toLowerCase()] || planet[0].toUpperCase();
            return (
              <div key={planet} className="flex justify-between border-b border-white/5 py-2">
                <span>{symbol} {planet}</span>
                <span className="font-serif text-white">{data.longitude?.toFixed(2)}°</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
