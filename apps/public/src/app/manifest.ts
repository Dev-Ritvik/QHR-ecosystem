import type { MetadataRoute } from 'next';

// What a phone is told when the site is kept on its home screen: its name,
// the hall's dark for the bar and the moment before the first picture, and
// the mark on its plate (scripts/brand/icons.mjs draws both sizes from the
// client's own artwork). A site, not an app: it opens in the browser.
//
// The forensic audit of 2026-10-09, #95: "no favicon.ico, no touch icon and no
// theme colour".
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Quality Homes Reality',
    short_name: 'Quality Homes',
    description: 'Approved plotted layouts in the northern coastal districts of Andhra Pradesh.',
    start_url: '/',
    display: 'browser',
    background_color: '#15110C',
    theme_color: '#15110C',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
