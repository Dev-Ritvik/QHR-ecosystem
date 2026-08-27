import { Inter, Playfair_Display } from 'next/font/google';
import './globals.css';

// Self-hosted fonts loaded via Next.js Font Optimization (NFR-S6 compliant)
const inter = Inter({ 
  subsets: ['latin'], 
  variable: '--font-sans',
  display: 'swap',
});

const playfair = Playfair_Display({ 
  subsets: ['latin'], 
  variable: '--font-serif',
  display: 'swap',
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      {/* The document's own ground, in the site's palette rather than the
          Tailwind default. It was bg-white on a build whose every surface is
          #0A1120, so any moment where the body showed — first paint before the
          segment layout mounts, overscroll bounce, a route without its own
          background — flashed white. The kiosk group paints its own
          bg-slate-900 over this, so it is unaffected. */}
      <body className="bg-[#0A1120] font-sans text-[#F2EDE4] antialiased">
        {children}
      </body>
    </html>
  );
}
