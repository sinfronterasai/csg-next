import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AETHERIA | Cosmic Astrology & Celestial Guidance',
  description: 'Interactive birth charts, celestial map explorer, and cosmic readings.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="selection:bg-gold selection:text-cosmic-950">{children}</body>
    </html>
  );
}
