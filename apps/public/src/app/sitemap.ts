import { MetadataRoute } from 'next';
import { db } from '@/lib/projection';
import { projectsPub } from '@estate/db/src/schema/projection';
import { PLACE_ROUTES, SURFACE_ROUTES } from '@estate/domain/experience/places';

// The base URL is not allowed to fall back to a placeholder. A sitemap is the
// one file whose entire purpose is to hand a crawler absolute URLs, so a wrong
// host here does not degrade gracefully — it publishes the whole site under a
// domain nobody owns. Failing loudly is the correct response to a missing
// value. (This previously defaulted to https://example.com.)
function baseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL;
  if (!raw) {
    throw new Error(
      'NEXT_PUBLIC_SITE_URL is not set. The sitemap needs the canonical origin ' +
        '(e.g. https://qualityhomesreality.in) and must not guess it.',
    );
  }
  return raw.replace(/\/$/, '');
}

// These render a <Pending> marker and are served noindex until the client's
// documents arrive, so listing them would ask Google to index pages that
// explicitly refuse indexing. Keep the two in agreement.
const NOINDEX_PENDING = new Set(['/privacy', '/terms', '/refund-policy']);

// Still carrying Slice 0 placeholder copy. Out until they are written.
const UNWRITTEN = new Set(['/about', '/why-us', '/site-home']);

// Registered in places.ts but with no page behind them yet. The registry is a
// map of the intended experience, not a record of what has been built, so
// deriving the sitemap from it alone publishes 404s — which is worse than
// omitting a page, because it teaches a crawler the site is unreliable.
//
// Verified by request, not by assumption: each of these returned 404 while the
// rest of the registry returned 200. Delete an entry the day its page lands,
// and the sitemap picks it up with no other change.
const UNBUILT = new Set(['/book-a-site-visit', '/projects', '/sitemap']);

// Higher priority for the routes that answer a buyer's question than for the
// ones that explain the company.
const PRIMARY = new Set(['/properties', '/start-here', '/downloads', '/contact']);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = baseUrl();
  const now = new Date();

  // Derived from the route registry rather than a hand-kept list, which would
  // silently rot every time a route is added. places.ts is already the single
  // place a new route must be registered, so a page cannot ship unlisted.
  const content = [...Object.keys(PLACE_ROUTES), ...Object.keys(SURFACE_ROUTES)]
    // '/' is emitted separately as the origin entry below; without this the
    // sitemap lists both `https://host` and `https://host/`, which a crawler
    // reads as two URLs serving identical content.
    .filter((r) => r !== '/')
    .filter((r) => !NOINDEX_PENDING.has(r) && !UNWRITTEN.has(r) && !UNBUILT.has(r))
    .sort();

  const sitemap: MetadataRoute.Sitemap = [
    { url: base, lastModified: now, changeFrequency: 'weekly', priority: 1 },
  ];

  for (const route of content) {
    sitemap.push({
      url: `${base}${route}`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: PRIMARY.has(route) ? 0.9 : 0.6,
    });
  }

  const projects = await db
    .select({ slug: projectsPub.slug, updatedAt: projectsPub.updatedAt })
    .from(projectsPub);

  for (const project of projects) {
    sitemap.push({
      url: `${base}/projects/${project.slug}`,
      lastModified: project.updatedAt || now,
      changeFrequency: 'weekly',
      priority: 0.8,
    });
  }

  // Individual plot pages are deliberately absent, where this file previously
  // emitted one per unit. There are 407 of them, they carry no price and no
  // descriptive copy, and their numbering is provisional until the client's
  // plot register arrives (PROGRESS.md §8). Handing a crawler 407 near-identical
  // thin pages would dilute the three project pages that actually rank, and
  // would publish plot numbers we have already said are not final.

  return sitemap;
}
