// apps/monolith/src/app/layout.tsx
//
// ROOT layout — MASTER_SPEC §4.2.
//
// Deliberately contains NO canvas. The <Canvas> mounts one level down, in
// (experience)/layout.tsx, and that single decision removes an entire class of
// workaround:
//
//   Claude.md and Gemini.md both put the canvas here, at root. That forces
//   not-found.tsx to render INSIDE the canvas tree, which forced Claude.md to
//   invent an `isErrorState` Zustand flag purely to stop context creation on a
//   404. Mounting inside the route group means not-found.tsx sits outside it
//   and no canvas ever mounts. The problem stops existing rather than being
//   solved well.
//
// No font imports. The interface voice is system monospace and the display face
// is system sans — see globals.css. A webfont on the critical path costs LCP
// for type that is deliberately plain.

import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import './globals.css';

// ONE FACE, EVERYWHERE. There is no display face and no sans: headline, body,
// data key and bracketed control are all this same technical monospace at
// different rungs of the scale. That is what makes the surface read as one
// instrument rather than as a page with a UI bolted onto it.
//
// next/font self-hosts at build time, so this is served from /_next/static —
// no third-party connection, nothing render-blocking, and nothing the CSP has
// to be widened for.
const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  display: 'swap',
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'The Monolith at Dusk — Quality Homes Reality',
  description:
    'Approved layouts, farmland and villas across the Visakhapatnam–Vizianagaram–Srikakulam corridor.',
};

export const viewport: Viewport = {
  themeColor: '#050505',
  // The scroll narrative depends on a stable viewport height. Allowing zoom is
  // non-negotiable for accessibility, so the narrative must tolerate it rather
  // than the other way round.
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={mono.variable}>
      <body>{children}</body>
    </html>
  );
}
