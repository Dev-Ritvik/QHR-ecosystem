// apps/public/src/components/site/siteMap.ts
//
// THE SITE, SET OUT ONCE: its parts, the pages in each, and the order they are
// read in.
//
// Four things read this, and they used to be four lists kept by hand — the
// menu, the footer, the sitemap page and the "next" at the foot of each page —
// which is how a page comes to exist with no way to reach it (three did: the
// registry named them and nothing linked to them). One list, so a page that is
// added here is in the menu, the footer and the sitemap the same day, and has
// a page before it and a page after it.
//
// THE ORDER IS THE STORY. A visitor who simply follows "next" from the film
// reads the site as it would be told across a table: the land first — the
// layouts, their plots, where they are, the drawings — then who is selling it
// and how, then what to check before buying, and last how to come and see it.
//
// ONE NAME A PAGE (the forensic audit of 2026-10-09, #91). A page had a name
// here and, where that was long, a shorter one for the menu; the film's footer
// kept a list of its own with a third; the tab's title and the not-found
// page's list each had theirs. /downloads was "Downloads", "Layout plans",
// "Take the plans with you" and "The approved plans" — eight pages had two to
// four names, and a visitor could not be sure two links went to one place. A
// page has ONE name now, short enough for every place it is printed: the
// menu, both footers, the sitemap, the "next" at a page's foot, the not-found
// page and the tab (`pageTitle`). What a page SAYS at its head is its title —
// a statement, the page's own — and is not its name.
//
// Pure data: nothing is imported, so the page's script, the header and a test
// can all read it.

export interface SitePage {
  href: string;
  /** What the page is called, everywhere it is named. */
  name: string;
  /** One line about it: what a visitor finds there. */
  line: string;
}

export interface SitePart {
  title: string;
  /** One line about the part. */
  line: string;
  pages: SitePage[];
}

export const SITE_PARTS: readonly SitePart[] = [
  {
    title: 'The land',
    line: 'Three approved layouts in two districts: what they are, how large, and where.',
    pages: [
      {
        href: '/projects',
        name: 'The layouts',
        line: 'The three layouts open now, each with its sanctioned plan.',
      },
      {
        href: '/properties',
        name: 'Plots and sizes',
        line: 'Every plot size on offer and the road it stands on, off the approved drawings.',
      },
      {
        href: '/locations',
        name: 'Locations',
        line: 'The villages, the roads in, and what stands nearby.',
      },
      {
        href: '/gallery',
        name: 'The plans',
        line: 'The three sanctioned sheets, to read closely.',
      },
      {
        href: '/downloads',
        name: 'Downloads',
        line: 'Each plan as a file, small enough to send on.',
      },
      {
        href: '/construction-updates',
        name: 'On the ground',
        line: 'How many plots each layout has, and how many are open today.',
      },
    ],
  },
  {
    title: 'The company',
    line: 'Twenty years in the northern coastal districts, from three offices.',
    pages: [
      {
        href: '/about',
        name: 'About',
        line: 'Who is selling this land, and for how long they have been.',
      },
      {
        href: '/why-us',
        name: 'How we work',
        line: 'Five things this company does, and where to check each.',
      },
      {
        href: '/testimonials',
        name: 'What buyers say',
        line: 'Accounts in the buyers’ own words.',
      },
      {
        href: '/branches',
        name: 'Offices',
        line: 'Visakhapatnam, Vizianagaram and Srikakulam, and the layouts each holds.',
      },
      {
        href: '/careers',
        name: 'Careers',
        line: 'The roles open now, and how to apply.',
      },
    ],
  },
  {
    title: 'Before you buy',
    line: 'What to check before money moves, written to be useful wherever you buy.',
    pages: [
      {
        href: '/start-here',
        name: 'Start here',
        line: 'The short version, for a visitor who knows what they came for.',
      },
      {
        href: '/investment-guide',
        name: 'The guide',
        line: 'Registration, title, approvals, and what the new airport changes.',
      },
      {
        href: '/knowledge',
        name: 'Knowledge',
        line: 'Short pieces on the parts of a purchase that are easy to get wrong.',
      },
      {
        href: '/faqs',
        name: 'Questions',
        line: 'What people ask first, answered plainly.',
      },
    ],
  },
  {
    title: 'Come and see',
    line: 'The land is best seen from the land.',
    pages: [
      {
        href: '/book-a-site-visit',
        name: 'Book a site visit',
        line: 'Name a layout and a day; the branch that holds it will take you there.',
      },
      {
        href: '/contact',
        name: 'Enquire',
        line: 'One enquiry, read by the office that holds the layout you ask about.',
      },
      {
        href: '/hall',
        name: 'The hall',
        line: 'The three layouts raised on their tables, to walk round.',
      },
    ],
  },
] as const;

/** The small print: read from wherever a visitor already is. */
export const SITE_SMALL_PRINT: readonly SitePage[] = [
  { href: '/privacy', name: 'Privacy', line: 'What is collected, and what you can do about it.' },
  { href: '/terms', name: 'Terms', line: 'Who the terms are with, and what they cover.' },
  { href: '/refund-policy', name: 'Refunds', line: 'If a purchase is cancelled.' },
  { href: '/cookie-policy', name: 'Cookies', line: 'What is stored on your device, and your choices.' },
  { href: '/sitemap', name: 'Sitemap', line: 'Every page, in order.' },
] as const;

/** The film: the one page that is in no part (it is the way in to them all). */
export const FILM_PAGE: SitePage = { href: '/', name: 'The film', line: 'The whole site, from the gate.' };

/** Every page the parts name, in reading order. */
export function sitePagesInOrder(): SitePage[] {
  return SITE_PARTS.flatMap((p) => p.pages);
}

/** A page by its address: of a part, of the small print, or the film. */
export function sitePage(href: string): SitePage | undefined {
  if (href === FILM_PAGE.href) return FILM_PAGE;
  return sitePagesInOrder().find((p) => p.href === href) ?? SITE_SMALL_PRINT.find((p) => p.href === href);
}

/**
 * The page of the small print after this one, in its own order and round
 * again: a visitor reading the terms is led to the refunds, not back to where
 * they came from. (Each of the four used to name one other by hand, under
 * names of their own: "Terms of use", "Cancellation and refunds".)
 */
export function smallPrintAfter(href: string): SitePage {
  const i = SITE_SMALL_PRINT.findIndex((p) => p.href === href);
  return SITE_SMALL_PRINT[(i + 1) % SITE_SMALL_PRINT.length] ?? SITE_SMALL_PRINT[0];
}

/** What the house is called at the end of every tab's title. */
export const SITE_NAME = 'Quality Homes Reality';

/**
 * A page's title in the browser's tab: its one name, and the house's. (Each
 * page used to write its own, and seven of them wrote a name the menu did
 * not use: "The Hall", "In their words", "Cancellation & Refunds".)
 */
export function pageTitle(href: string): string {
  const page = sitePage(href);
  if (!page) throw new Error(`siteMap: no page at ${href}`);
  return `${page.name} — ${SITE_NAME}`;
}

/** The part a page belongs to, for its plate's kicker. */
export function partOf(href: string): SitePart | undefined {
  return SITE_PARTS.find((p) => p.pages.some((pg) => pg.href === href));
}

/**
 * The page after this one in the reading order. The last page of the story
 * leads back to its first part: a visitor who has read to the end and has not
 * yet asked to visit is shown the land again, not a dead end.
 */
export function pageAfter(href: string): SitePage {
  const all = sitePagesInOrder();
  const i = all.findIndex((p) => p.href === href);
  return all[(i + 1) % all.length] ?? all[0];
}
