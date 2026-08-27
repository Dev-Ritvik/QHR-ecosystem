// apps/public/src/app/api/brochure/[projectSlug]/[unitSlug]/route.ts
//
// FR-W6 / NFR-D5: renders the unit detail page to PDF in print mode.
//
// WHAT THIS ROUTE USED TO BE
//
// An unauthenticated GET that called chromium.launch() per request, navigated
// with `waitUntil: 'networkidle'` and no timeout, and closed the browser on the
// success path only — `browser.close()` sat after the `page.pdf()` await with
// the catch block closing nothing. So the most likely thing to throw (a
// navigation that never reaches network idle) was also the thing that leaked a
// whole Chromium process, permanently, with no cap on how many could be started
// at once. A short request loop took the host down, and it took the rest of the
// site with it.
//
// It stays public. The public site has no authentication anywhere — adding a
// login in front of a marketing brochure would be inventing an architecture
// that does not exist here. The fix is to bound what a request can cost, not to
// ask it who it is:
//
//   * ONE browser process for the lifetime of the server, reused, relaunched
//     only if it dies. Not one per request.
//   * A concurrency gate over pages, with a bounded wait that fails fast rather
//     than growing a backlog.
//   * A per-IP rate limit.
//   * An explicit timeout on every await that touches the browser, and an
//     overall deadline over the whole render.
//   * Page close in `finally`, gate release in `finally`.
//   * Conditional requests answered BEFORE any of that — a repeat download
//     costs one indexed SELECT and a 304 instead of a browser page.
//
// The Chromium sandbox is still disabled. That is a deployment property rather
// than something this file can decide: the flags exist because the target runs
// as root in a container. The page being rendered is our own origin and both
// slugs have already been matched against the projection, so nothing
// attacker-controlled reaches the navigation. Worth revisiting when the host is
// known; it is not what made this route dangerous.

import { NextRequest, NextResponse } from 'next/server';
import { chromium, type Browser } from 'playwright';
import { db } from '@/lib/projection';
import { projectsPub, unitsPub } from '@estate/db';
import { eq, and } from 'drizzle-orm';
import { ConcurrencyGate, RateLimiter } from '@/lib/brochure/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Concurrent PDF renders. Chromium pages are expensive; two is a real ceiling. */
const MAX_CONCURRENT = 2;
/** How long a request will wait for a slot before giving up with 503. */
const QUEUE_WAIT_MS = 5_000;
/** Navigation budget. */
const NAV_TIMEOUT_MS = 15_000;
/** Whole-render deadline, independent of the per-step ones. */
const TOTAL_TIMEOUT_MS = 25_000;
/** Per-IP ceiling. */
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;
/**
 * Ceiling on total renders per minute, across every caller.
 *
 * The per-IP limit is only as trustworthy as x-forwarded-for, which the caller
 * supplies (see clientKey). This one cannot be spoofed away because it does not
 * look at the request at all. Generous against real use — a brochure is a
 * once-per-visit action and there are 407 units — and still a hard bound on how
 * much Chromium time the endpoint can be made to spend.
 */
const GLOBAL_LIMIT = 30;

const gate = new ConcurrencyGate(MAX_CONCURRENT);
const limiter = new RateLimiter(RATE_LIMIT, RATE_WINDOW_MS);
const globalLimiter = new RateLimiter(GLOBAL_LIMIT, RATE_WINDOW_MS);

/**
 * One browser, lazily started and shared.
 *
 * The promise itself is the lock: concurrent first-callers await the same
 * launch instead of racing to start several. `disconnected` clears it so a
 * crashed browser is replaced on the next request rather than wedging the
 * endpoint forever.
 */
let browserPromise: Promise<Browser> | null = null;

function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium
      .launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          // Containers default /dev/shm to 64MB; Chromium treats exhausting it
          // as a crash. This is the single most common cause of "it works
          // locally and dies in the image".
          '--disable-dev-shm-usage',
        ],
      })
      .then((b) => {
        b.on('disconnected', () => {
          browserPromise = null;
        });
        return b;
      })
      .catch((err) => {
        browserPromise = null;
        throw err;
      });
  }
  return browserPromise;
}

/**
 * Per-caller key — and an honest note about what it is worth.
 *
 * x-forwarded-for is set by the caller unless a proxy overwrites it, so a
 * client that sends its own header gets a fresh bucket on every request. That
 * is not hypothetical: it is exactly how this endpoint's own rate limit was
 * side-stepped while testing it. Behind a proxy that rewrites XFF this is a
 * real per-IP limit; exposed directly it is closer to a courtesy.
 *
 * So it is no longer the only thing standing between a caller and the browser.
 * GLOBAL_LIMIT below caps total renders per minute regardless of what any
 * header claims, and the concurrency gate caps how many can run at once. Those
 * two are header-independent, which is the property that actually matters.
 */
function clientKey(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

function deadline<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => {
      const err = new Error(label);
      err.name = 'Timeout';
      reject(err);
    }, ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectSlug: string; unitSlug: string }> },
) {
  const { projectSlug, unitSlug } = await params;

  // 1. Rate limit before any work at all, including the query.
  //    Global first: it is the one a caller cannot influence.
  if (!globalLimiter.take('*')) {
    return NextResponse.json(
      { error: 'Brochure service is busy. Please try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(globalLimiter.retryAfter('*')) } },
    );
  }
  const key = clientKey(req);
  if (!limiter.take(key)) {
    return NextResponse.json(
      { error: 'Too many brochure requests. Please wait a moment.' },
      { status: 429, headers: { 'Retry-After': String(limiter.retryAfter(key)) } },
    );
  }

  // 2. Verify the unit exists and get the price version the ETag is keyed on.
  const results = await db
    .select({
      unitId: unitsPub.unitId,
      priceVersionId: unitsPub.priceVersionId,
    })
    .from(unitsPub)
    .innerJoin(projectsPub, eq(unitsPub.projectId, projectsPub.projectId))
    .where(and(eq(projectsPub.slug, projectSlug), eq(unitsPub.unitNumber, unitSlug)))
    .limit(1);

  if (results.length === 0) {
    return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
  }

  const unit = results[0];
  const etag = `"${unit.priceVersionId || 'no-price'}"`;

  // 3. Conditional request short-circuit.
  //
  // This is protection, not just politeness: the common case for this endpoint
  // is the same visitor re-downloading the same unchanged brochure, and
  // answering that with a 304 means a browser page is never opened. It also
  // repairs the caching contract — the old headers said `immutable` with
  // max-age=31536000, which tells the client never to revalidate, so the ETag
  // keyed on priceVersionId could never actually invalidate anything and a
  // price change could serve a stale brochure for a year.
  if (req.headers.get('if-none-match') === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: { ETag: etag, 'Cache-Control': 'public, max-age=300, must-revalidate' },
    });
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!baseUrl) {
    // Never guess the origin: a wrong one renders somebody else's page to PDF
    // under our filename.
    console.error('[brochure] NEXT_PUBLIC_SITE_URL is not set; refusing to render.');
    return NextResponse.json({ error: 'Brochure service unavailable' }, { status: 503 });
  }
  const targetUrl = `${baseUrl.replace(/\/$/, '')}/projects/${projectSlug}/${unitSlug}`;

  // 4. Wait for a slot, or shed the request.
  let release: () => void;
  try {
    release = await gate.acquire(QUEUE_WAIT_MS);
  } catch {
    return NextResponse.json(
      { error: 'Brochure service is busy. Please try again shortly.' },
      { status: 503, headers: { 'Retry-After': '10' } },
    );
  }

  type BrochurePage = Awaited<ReturnType<Browser['newPage']>>;
  let page: BrochurePage | null = null;
  // Held separately from `page` because the deadline can fire in the window
  // between calling newPage() and its promise resolving. In that case the
  // rejection unwinds to `finally` while `page` is still null, the promise
  // settles a moment later, and the page it produced is never closed — an
  // orphan holding a renderer process, which is the exact leak this route was
  // rewritten to eliminate. `finally` awaits this instead so there is nothing
  // newPage can hand back that we fail to close.
  let pagePromise: Promise<BrochurePage> | null = null;
  try {
    const pdfBuffer = await deadline(
      (async () => {
        const browser = await getBrowser();
        pagePromise = browser.newPage();
        page = await pagePromise;
        page.setDefaultTimeout(NAV_TIMEOUT_MS);

        // Print media so Tailwind's print variants resolve before layout.
        await page.emulateMedia({ media: 'print' });

        // `load` rather than `networkidle`, with an explicit budget. networkidle
        // has no upper bound by definition — anything that keeps a connection
        // open (a map tile source, an analytics beacon, a hung image) holds the
        // request open forever, which is what made an unclosed browser fatal.
        await page.goto(targetUrl, { waitUntil: 'load', timeout: NAV_TIMEOUT_MS });

        // Best-effort settle for late images. Advisory: if it does not go quiet
        // we still render, rather than failing a brochure over a slow asset.
        await page
          .waitForLoadState('networkidle', { timeout: 3_000 })
          .catch(() => undefined);

        // page.pdf() takes no timeout of its own in this Playwright version;
        // setDefaultTimeout above and the TOTAL_TIMEOUT_MS deadline around this
        // whole block are what bound it.
        return page.pdf({
          format: 'A4',
          printBackground: true,
          margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' },
        });
      })(),
      TOTAL_TIMEOUT_MS,
      'BrochureRenderTimeout',
    );

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Brochure-${projectSlug}-${unitSlug}.pdf"`,
        // Revalidate against the ETag rather than pinning for a year.
        'Cache-Control': 'public, max-age=300, must-revalidate',
        ETag: etag,
      },
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'Timeout';
    console.error('[brochure] generation failed', {
      projectSlug,
      unitSlug,
      timedOut,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Failed to generate brochure' },
      { status: timedOut ? 504 : 500 },
    );
  } finally {
    // Both of these ran only on the success path before. The page is what holds
    // the renderer process, so failing to close it is the leak.
    //
    // Resolve through pagePromise rather than `page`, so a page created after
    // the deadline already unwound is still closed rather than orphaned.
    const opened: BrochurePage | null =
      page ?? (pagePromise ? await (pagePromise as Promise<BrochurePage>).catch(() => null) : null);
    if (opened) {
      await opened.close().catch(() => undefined);
    }
    release();
  }
}
