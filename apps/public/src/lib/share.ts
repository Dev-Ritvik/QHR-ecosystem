// apps/public/src/lib/share.ts
//
// WHAT A PAGE LOOKS LIKE WHERE ITS LINK IS PASTED.
//
// The forensic audit of 2026-10-09 (#95): "25 of 28 pages, including the home
// page, have no share image or share title, so a link pasted into WhatsApp
// shows no picture … For a site sold by sharing a link, the shared card is the
// first impression." Only a layout's own page had one, drawn by a route left
// from the starter kit (a grey sheet that said ESTATE): gone, and the layouts'
// pages are carded as every other page is.
//
// Every page's card is now made the same way, from what the page already
// says of itself: its title, its description, and ITS OWN OPENING PICTURE —
// the still of its first frame (components/experience/stills.ts), cut to a
// card's shape by the script that cuts the stills (scripts/stills/share.py),
// so a page that is given a new picture is given a new card with it and the
// two cannot come apart.
//
// Addresses are written from the site's root and made whole by the root
// layout's `metadataBase` (NEXT_PUBLIC_SITE_URL): the one place the site's
// domain is said.

import type { Metadata } from 'next';
import { stillKeyForRoute } from '@/components/experience/stills';
import { SITE_NAME } from '@/components/site/siteMap';

/** A card's picture: 1200 x 630, the shape every messenger and network crops to. */
export const SHARE_SIZE = { width: 1200, height: 630 } as const;

/** The folder the cards' pictures are published in (scripts/stills/share.py). */
export const SHARE_DIR = '/share';

/** The picture a page is shared with: its own opening frame. */
export function shareImage(href: string): string {
  return `${SHARE_DIR}/${stillKeyForRoute(href)}.jpg`;
}

/**
 * A page's metadata, with its card: the same title and description for the
 * card as for the tab and the search result, the page's own picture, and its
 * one address.
 */
export function withShare(href: string, meta: Metadata): Metadata {
  const title = typeof meta.title === 'string' ? meta.title : SITE_NAME;
  const description = meta.description ?? undefined;
  const image = { url: shareImage(href), ...SHARE_SIZE, alt: title };
  return {
    ...meta,
    alternates: { canonical: href, ...meta.alternates },
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      locale: 'en_IN',
      url: href,
      title,
      description,
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}
