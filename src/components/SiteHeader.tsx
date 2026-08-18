'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SiteHeader() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth/user');
        setAuthed(res.ok);
      } catch {
        setAuthed(false);
      }
    })();
  }, []);

  function logout() {
    fetch('/api/auth/logout', { method: 'POST' })
      .then((res) => {
        if (res.ok) {
          setAuthed(false);
          setOpen(false);
        }
      })
      .catch(() => {})
      .finally(() => {
        router.push('/');
        router.refresh();
      });
  }

  const navLinks = (
    <>
      <a href="/constellations" className="text-gray-300 hover:text-gold transition-colors duration-300">Constellations</a>
      <a href="/blog" className="text-gray-300 hover:text-gold transition-colors duration-300">Blog</a>
      <a href="/birth-chart" className="text-gray-300 hover:text-gold transition-colors duration-300">Birth Chart</a>
      <a href="/tarot" className="text-gray-300 hover:text-gold transition-colors duration-300">Tarot</a>
      <div className="relative group">
        <button onClick={() => router.push('/reports')} className="flex items-center gap-2 text-gray-300 hover:text-gold transition-colors duration-300">
          Reports
          <span className="text-[9px] uppercase tracking-widest text-cosmic-950 bg-gold rounded-full px-1.5 py-0.5 font-bold">Premium</span>
          <i className="fa-solid fa-chevron-down text-[9px]" />
        </button>
        <div className="absolute left-1/2 -translate-x-1/2 mt-3 w-64 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
          <div className="glass-panel rounded-2xl border border-gold/20 p-2" style={{ background: '#1E1B4B' }}>
            {[
              { label: 'Birth Chart Report', price: 'FREE', href: '/reports' },
              { label: 'Yearly Transit Forecast', price: '$49', href: '/reports' },
              { label: 'Synastry Love Report', price: '$65', href: '/reports' },
              { label: 'Vocation & Wealth Map', price: '$55', href: '/reports' },
              { label: 'Tarot Spreads', price: 'from $4.99', href: '/tarot' },
              { label: 'Book a Live Zoom', price: '$120', href: '/reports' },
            ].map((r) => (
              <a key={r.label} href={r.href} className="flex items-center justify-between px-4 py-2.5 rounded-xl hover:bg-white/5 transition-colors">
                <span className="text-sm text-gray-200">{r.label}</span>
                <span className="text-xs text-gold font-serif ml-3 whitespace-nowrap">{r.price}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </>
  );

  return (
    <header className="fixed top-0 left-0 w-full z-50 transition-all duration-300 px-6 lg:px-16 py-5">
      <div className="max-w-7xl mx-auto flex justify-between items-center glass-panel px-6 py-4 rounded-full border-opacity-20 glow-border">
        <a href="/" className="flex items-center space-x-3 group">
          <div className="relative w-10 h-10 flex items-center justify-center">
            <span className="absolute inset-0 border border-gold rounded-full rotate-45 group-hover:rotate-180 transition-transform duration-1000"></span>
            <span className="absolute inset-1 border border-dashed border-gold rounded-full -rotate-45 group-hover:-rotate-180 transition-transform duration-1000"></span>
            <i className="fa-solid fa-moon text-gold text-lg absolute"></i>
          </div>
          <span className="font-serif text-xl tracking-widest text-white group-hover:text-gold transition-colors duration-300">COSMIC SPIRIT GUIDE</span>
        </a>

        <nav className="hidden md:flex items-center space-x-8 text-sm tracking-widest">
          {navLinks}
        </nav>

        <div className="hidden md:flex items-center space-x-4">
          {authed === null ? (
            <span className="text-xs uppercase tracking-widest text-gray-400">…</span>
          ) : authed ? (
            <>
              <a href="/profile" className="text-sm uppercase tracking-widest text-gray-300 hover:text-gold transition-colors duration-300">My Profile</a>
              <button onClick={logout} className="text-sm uppercase tracking-widest border border-gold rounded-full px-4 py-1.5 text-gold hover:text-white transition-colors duration-300">Sign Out</button>
            </>
          ) : (
            <>
              <a href="/login" className="text-sm uppercase tracking-widest text-gray-300 hover:text-gold transition-colors duration-300">Login</a>
              <a href="/signup" className="relative inline-flex items-center justify-center px-6 py-2.5 overflow-hidden font-medium tracking-widest text-xs uppercase border border-gold rounded-full group">
                <span className="absolute inset-0 w-full h-full transition duration-300 ease-out opacity-0 bg-gradient-to-r from-cosmic-primary to-cosmic-secondary group-hover:opacity-100"></span>
                <span className="relative text-gold group-hover:text-white transition-colors duration-300">Sign Up</span>
              </a>
            </>
          )}
        </div>

        <button className="md:hidden text-gold focus:outline-none" onClick={() => setOpen((s) => !s)}>
          <i className="fa-solid fa-bars text-2xl"></i>
        </button>
      </div>

      {open && (
        <div className="md:hidden mt-3 mx-2 glass-panel rounded-3xl p-6 flex flex-col space-y-4 text-center tracking-widest transition-all duration-300">
          {navLinks}
          {authed ? (
            <>
              <a href="/profile" className="bg-gradient-to-r from-cosmic-primary to-cosmic-secondary text-white py-3 rounded-full text-xs uppercase font-semibold">My Profile</a>
              <button onClick={logout} className="border border-gold text-gold hover:text-white py-3 rounded-full text-xs uppercase font-semibold transition-colors duration-300">Sign Out</button>
            </>
          ) : (
            <>
              <a href="/login" className="text-gray-300 hover:text-gold py-2 border-b border-white/5">Login</a>
              <a href="/signup" className="bg-gradient-to-r from-cosmic-primary to-cosmic-secondary text-white py-3 rounded-full text-xs uppercase font-semibold">Sign Up</a>
            </>
          )}
        </div>
      )}
    </header>
  );
}
