import type { Metadata } from 'next';
import Script from 'next/script';
import SiteHeader from '@/components/SiteHeader';
import './globals.css';

export const metadata: Metadata = {
  title: 'COSMIC SPIRIT GUIDE | Cosmic Astrology & Celestial Guidance',
  description: 'Interactive birth charts, celestial map explorer, and cosmic readings.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700;800;900&family=Inter:wght@200;300;400;500;600;700&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" integrity="sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA==" crossOrigin="anonymous" referrerPolicy="no-referrer" />
        <Script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js" strategy="afterInteractive" />
        <Script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js" strategy="afterInteractive" />
      </head>
      <body className="selection:bg-gold selection:text-cosmic-950 antialiased">
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
          <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] rounded-full bg-cosmic-primary opacity-[0.15] blur-[150px]" />
          <div className="absolute bottom-[20%] -right-[10%] w-[60%] h-[60%] rounded-full bg-cosmic-secondary opacity-[0.1] blur-[180px]" />
          <div className="absolute top-[40%] left-[30%] w-[40%] h-[40%] rounded-full bg-blue-900 opacity-[0.12] blur-[160px]" />
        </div>
        <div className="relative z-10">
          <SiteHeader />
          <main className="pt-24">{children}</main>
        </div>
      </body>
    </html>
  );
}
