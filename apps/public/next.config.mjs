import { withSentryConfig } from "@sentry/nextjs";

/**
 * NFR-S6: Strict CSP on all surfaces.
 * Presentation bundle accesses MapTiler, Supabase Storage, Supabase Realtime (wss://),
 * and optionally PostHog (for the public site route group).
 *
 * @type {import("next").NextConfig}
 */
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline' https://us.i.posthog.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data: https://*.supabase.co https://*.maptiler.com;
  font-src 'self';
  object-src 'none';
  base-uri 'none';
  form-action 'self';
  frame-ancestors 'none';
  worker-src 'self' blob:;
  connect-src 'self' blob: https://*.supabase.co wss://*.supabase.co https://*.maptiler.com https://us.i.posthog.com;
`.replace(/\s{2,}/g, ' ').trim();

// `blob:` in connect-src is required, not a loosening.
//
// GLTFLoader hands each embedded KTX2 texture to KTX2Loader as a blob: URL
// created from the GLB's own buffer, and the transcoder worker fetches it back.
// Without this every one of the hall's 28 textures failed with "THREE.
// GLTFLoader: Couldn't load texture blob:..." and the WASM transcoder then
// aborted with a LinkError, which read like a corrupt binary but was only the
// downstream symptom.
//
// It grants nothing outward-facing: a blob: URL is same-origin by construction
// and can only ever address data this page already produced.

/** @type {import("next").NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: cspHeader },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          // DENY is an X-Frame-Options token, not a Referrer-Policy one. Browsers
          // ignore an unrecognised Referrer-Policy value, so the header was inert.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // Suppresses Sentry build-time logs; set to false to see upload confirmations
  silent: true,
  // Hides Sentry source maps from the client bundle
  hideSourceMaps: true,
});
