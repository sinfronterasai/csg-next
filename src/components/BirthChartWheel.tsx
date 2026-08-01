'use client';

import { useRef, useState, useCallback } from 'react';
import type { ChartData, PlanetPlacement, HousePlacement } from '../lib/chartEngine';
import {
  SIGNS, getSign, getPlanet, getHouse, formatDegree,
} from '../lib/astrology';

const zodiacSymbols: Record<string, string> = {
  aries: '♈', taurus: '♉', gemini: '♊', cancer: '♋', leo: '♌', virgo: '♍',
  libra: '♎', scorpio: '♏', sagittarius: '♐', capricorn: '♑', aquarius: '♒', pisces: '♓',
};

const planetSymbols: Record<string, string> = {
  sun: '☉', moon: '☽', mercury: '☿', venus: '♀', mars: '♂', jupiter: '♃', saturn: '♄',
  uranus: '♅', neptune: '♆', pluto: '♇', northnode: '☊', southnode: '☋', chiron: '⚷',
};

function planetColor(p: PlanetPlacement): string {
  if (p.key === 'northnode' || p.key === 'southnode' || p.key === 'chiron') return '#ec4899';
  return '#c45b7a';
}
function dignityBadge(d: PlanetPlacement['dignity']): { sym: string; color: string } | null {
  switch (d) {
    case 'domicile': return { sym: '👑', color: '#f59e0b' };
    case 'exaltation': return { sym: '↑', color: '#10b981' };
    case 'detriment': return { sym: '↓', color: '#f97316' };
    case 'fall': return { sym: '×', color: '#ef4444' };
    default: return null;
  }
}

interface ActiveSelection {
  type: 'planet' | 'house' | 'sign';
  key: string;
  title: string;
  subtitle?: string;
  body: string;
}

export default function BirthChartWheel({ chartData, interactive = false }: { chartData: ChartData; interactive?: boolean }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState<ActiveSelection | null>(null);
  const [viewMode, setViewMode] = useState<'wheel' | 'table'>('wheel');

  const centerX = 500;
  const centerY = 400;
  const outerRadius = 350;
  const zodiacRadius = 320;
  const planetRadius = 280;
  const innerRadius = 240;

  const getPointOnCircle = (radius: number, angle: number) => {
    const rad = (angle - 90) * Math.PI / 180;
    return { x: centerX + radius * Math.cos(rad), y: centerY + radius * Math.sin(rad) };
  };

  const selectPlanet = useCallback((p: PlanetPlacement) => {
    setActive({
      type: 'planet',
      key: p.key,
      title: `${p.glyph} ${p.label} in ${p.signLabel}`,
      subtitle: `${formatDegree(p.longitude)} ${p.retrograde ? '(retrograde)' : ''} · House ${p.house ?? '—'}`,
      body: `${p.description} Currently in ${p.signLabel} (${getSign(p.sign)?.element}, ${getSign(p.sign)?.modality}), ${formatDegree(p.degreeInSign)} into the sign.${p.dignity ? ` This is its ${p.dignity} — a place of strength.` : ''}`,
    });
  }, []);

  const selectHouse = useCallback((h: HousePlacement) => {
    setActive({
      type: 'house',
      key: `house-${h.num}`,
      title: `${h.num}${ordSuffix(h.num)} House — ${h.area}`,
      subtitle: `Cusp ${formatDegree(h.cuspLongitude)} in ${h.signLabel}`,
      body: h.description,
    });
  }, []);

  const selectSign = useCallback((key: string) => {
    const s = getSign(key);
    if (!s) return;
    setActive({
      type: 'sign',
      key,
      title: `${s.glyph} ${s.label}`,
      subtitle: `${s.element} · ${s.modality} · Ruled by ${s.ruler}`,
      body: s.explanation,
    });
  }, []);

  const downloadChart = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const canvas = document.createElement('canvas');
    canvas.width = 1400; canvas.height = 1000;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    img.onload = () => {
      ctx.fillStyle = '#03000a';
      ctx.fillRect(0, 0, 1400, 1000);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        const link = document.createElement('a');
        link.download = `birth-chart-${(chartData.birth.date || 'chart')}.png`;
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
    link.download = `birth-chart-${(chartData.birth.date || 'chart')}.svg`;
    link.href = url; link.click();
    URL.revokeObjectURL(url);
  };

  const renderZodiacWheel = () => SIGNS.map((sign, index) => {
    const startAngle = index * 30;
    const midAngle = startAngle + 15;
    const point = getPointOnCircle(zodiacRadius, midAngle);
    const startPoint = getPointOnCircle(outerRadius, startAngle);
    const endPoint = getPointOnCircle(innerRadius, startAngle);
    const isActive = active?.type === 'sign' && active.key === sign.key;
    return (
      <g key={sign.key} onClick={() => interactive && selectSign(sign.key)} style={{ cursor: interactive ? 'pointer' : undefined }}>
        <line x1={startPoint.x} y1={startPoint.y} x2={endPoint.x} y2={endPoint.y} stroke="rgba(223,183,108,0.85)" strokeWidth="1" opacity={isActive ? 0.9 : 0.3} />
        <text x={point.x} y={point.y} textAnchor="middle" dominantBaseline="middle" fontSize="24" fill={isActive ? '#DFB76C' : 'rgba(223,183,108,0.9)'} fontWeight="bold">{zodiacSymbols[sign.key]}</text>
      </g>
    );
  });

  const renderHouses = () => chartData.houses.map((h) => {
    const cusp = h.cuspLongitude;
    const nextCusp = chartData.houses[(h.num % 12)].cuspLongitude;
    const mid = (cusp + nextCusp) / 2;
    const point = getPointOnCircle(innerRadius - 18, mid);
    const isActive = active?.type === 'house' && active.key === `house-${h.num}`;
    return (
      <g key={h.num} onClick={() => interactive && selectHouse(h)} style={{ cursor: interactive ? 'pointer' : undefined }}>
        <text x={point.x} y={point.y} textAnchor="middle" dominantBaseline="middle" fontSize="13" fill={isActive ? '#DFB76C' : 'rgba(255,255,255,0.55)'} fontWeight="bold">{h.num}</text>
      </g>
    );
  });

  const renderPlanets = () => chartData.planets.map((p) => {
    const angle = p.longitude;
    const point = getPointOnCircle(planetRadius, angle);
    if (Number.isNaN(point.x)) return null;
    const badge = dignityBadge(p.dignity);
    const isActive = active?.type === 'planet' && active.key === p.key;
    return (
      <g key={p.key} onClick={() => interactive && selectPlanet(p)} style={{ cursor: interactive ? 'pointer' : undefined }}>
        <circle cx={point.x} cy={point.y} r="20" fill="rgba(255,255,255,0.04)" stroke={isActive ? '#DFB76C' : planetColor(p)} strokeWidth={isActive ? 3 : 2} />
        <text x={point.x} y={point.y} textAnchor="middle" dominantBaseline="middle" fontSize="18" fill={isActive ? '#ffffff' : planetColor(p)} fontWeight="bold">{p.glyph}</text>
        {p.retrograde && <text x={point.x + 18} y={point.y - 12} textAnchor="middle" fontSize="12" fill="#ef4444" fontWeight="bold">℞</text>}
        {badge && <text x={point.x + 18} y={point.y + 12} textAnchor="middle" fontSize="12" fill={badge.color}>{badge.sym}</text>}
      </g>
    );
  });

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h4 className="text-2xl font-serif text-white">{chartData.name}</h4>
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
        <div className="max-w-md mx-auto">
          <svg ref={svgRef} viewBox="0 0 1000 800" className="w-full h-auto">
            <circle cx={centerX} cy={centerY} r={outerRadius} fill="none" stroke="rgba(223,183,108,0.25)" strokeWidth="1" />
            <circle cx={centerX} cy={centerY} r={zodiacRadius} fill="none" stroke="rgba(223,183,108,0.35)" strokeWidth="1" />
            <circle cx={centerX} cy={centerY} r={planetRadius} fill="none" stroke="rgba(223,183,108,0.25)" strokeWidth="1" />
            <circle cx={centerX} cy={centerY} r={innerRadius} fill="none" stroke="rgba(223,183,108,0.2)" strokeWidth="1" />
            {renderZodiacWheel()}
            {renderHouses()}
            {renderPlanets()}
          </svg>
        </div>
      ) : (
        <div className="space-y-3 text-sm text-gray-300">
          {chartData.planets.map((p) => (
            <div key={p.key} className="flex justify-between border-b border-white/5 py-2">
              <span>{p.glyph} {p.label} · {p.signLabel} {p.house ? `(H${p.house})` : ''} {p.retrograde ? '℞' : ''}</span>
              <span className="font-serif text-white">{formatDegree(p.longitude)}</span>
            </div>
          ))}
        </div>
      )}

      {interactive && active && (
        <div className="mt-4 glass-panel-light p-4 rounded-2xl border border-gold/20">
          <div className="flex justify-between items-start">
            <div>
              <h5 className="text-lg font-serif text-white">{active.title}</h5>
              {active.subtitle && <span className="text-xs text-gold tracking-wide">{active.subtitle}</span>}
            </div>
            <button onClick={() => setActive(null)} className="text-xs text-gray-400 hover:text-white">✕</button>
          </div>
          <p className="text-sm text-gray-300 leading-relaxed mt-2">{active.body}</p>
        </div>
      )}

      {interactive && !active && (
        <p className="mt-4 text-xs text-gray-500 text-center">Click any planet, sign, or house number on the wheel to reveal what it means.</p>
      )}
    </div>
  );
}

function ordSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
