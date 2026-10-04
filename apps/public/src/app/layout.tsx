import { Playfair } from 'next/font/google';
import './globals.css';

// Self-hosted fonts loaded via Next.js Font Optimization (NFR-S6 compliant)
//
// ONE FAMILY (the fourth art-direction critique, 2026-09-30: "Choose a single,
// exceptionally crafted typeface family and use scale and weight for
// hierarchy"). Playfair is the 2.0 of Playfair Display, the face the film's
// headlines were already set in, by the same designer and under the same
// licence (OFL) — and it adds the optical-size axis (5..1200) that lets one
// family carry a 10px caption and a 61px figure, each drawn for its size.
// globals.css explains the scale and the baseline built on it.
const playfair = Playfair({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
  style: ['normal', 'italic'],
  axes: ['opsz'],
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={playfair.variable}>
      {/* The document's own ground, in the site's palette rather than the
          Tailwind default. It was bg-white on a build whose every surface is
          #0A1120, so any moment where the body showed — first paint before the
          segment layout mounts, overscroll bounce, a route without its own
          background — flashed white. The kiosk group paints its own
          bg-slate-900 over this, so it is unaffected. */}
      <body className="bg-[#0A1120] text-[#F2EDE4] antialiased">
        {children}
      </body>
    </html>
  );
}
