import type { Metadata, Viewport } from 'next';
import { Playfair } from 'next/font/google';
import './globals.css';
import './folio.css';

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

/**
 * THE SITE'S ONE ADDRESS, and what a browser is told about the site itself
 * (the forensic audit of 2026-10-09, #95: "no favicon.ico, no touch icon and
 * no theme colour … the site's files name two different domains").
 *
 * The domain is said here and nowhere else: every page writes its own address
 * and its card's picture from the root (lib/share.ts), and they are made
 * whole by this. It comes from NEXT_PUBLIC_SITE_URL, as the sitemap's and
 * robots.txt's do (those two refuse to be built without it; a page falls back
 * to the machine it is running on, so a build on a desk still builds).
 *
 * The icons are files beside this one, which the framework links by their
 * names: `icon.svg` (the mark), `favicon.ico` and `apple-icon.png` (the mark
 * on its ivory plate, as the header carries it: scripts/brand/icons.mjs draws
 * them from the client's own artwork, untouched), and `manifest.ts`.
 */
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001'),
  applicationName: 'Quality Homes Reality',
};

/** The browser's own bar in the hall's dark, on a phone: the page's ground. */
export const viewport: Viewport = {
  themeColor: '#15110C',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={playfair.variable}>
      {/* The document's own ground, in the site's palette rather than the
          Tailwind default: any moment where the body shows — first paint
          before the segment layout mounts, overscroll bounce, a route without
          its own background — is the house's dark and not a white flash.
          THE HALL'S OWN DARK, the umber of its walnut in shade (folio.css,
          coverState.ts): it was the reading pages' midnight navy, a blue room
          round a gold picture. The kiosk group paints its own bg-slate-900
          over this, so it is unaffected. */}
      <body className="bg-[#15110C] text-[#F2EDE4] antialiased">
        {children}
      </body>
    </html>
  );
}
