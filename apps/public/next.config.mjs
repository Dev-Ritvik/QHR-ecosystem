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
  connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.maptiler.com https://us.i.posthog.com;
`.replace(/\s{2,}/g, ' ').trim();

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
          { key: 'Referrer-Policy', value: 'DENY' },
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
