/**
 * Monolith — Next config.
 *
 * CSP is strict and deliberately narrower than apps/public's, because this app
 * has a smaller external surface: no MapTiler, no PostHog until consent wires
 * one in.
 *
 * `blob:` is present in connect-src and worker-src on purpose — KTX2 transcoding
 * and Draco decoding both create blob workers, and omitting it produces a WASM
 * LinkError that looks like a decoder bug rather than a CSP block. That exact
 * misdiagnosis cost a day on apps/public.
 *
 * @type {import("next").NextConfig}
 */
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data: https://*.supabase.co;
  font-src 'self';
  object-src 'none';
  base-uri 'none';
  form-action 'self';
  frame-ancestors 'none';
  worker-src 'self' blob:;
  connect-src 'self' blob: https://*.supabase.co wss://*.supabase.co;
  upgrade-insecure-requests;
`;

const nextConfig = {
  reactStrictMode: true,

  /**
   * Production builds write to .next-prod, NOT .next.
   *
   * `next build` overwrites the dev server's chunk manifest, after which every
   * /_next/static/* request falls through to the 404 handler and is served as
   * text/html. The browser then refuses the stylesheet on MIME grounds and the
   * page renders completely unstyled — which looks like a CSS bug and is
   * actually a build collision.
   *
   * That happened here once. Separating the directories makes it impossible
   * rather than merely unlikely.
   */
  distDir: process.env.NEXT_DIST_DIR || '.next',
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: cspHeader.replace(/\s{2,}/g, ' ').trim(),
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

export default nextConfig;
