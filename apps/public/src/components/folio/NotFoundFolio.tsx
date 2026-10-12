// apps/public/src/components/folio/NotFoundFolio.tsx
//
// THE PAGE THAT IS NOT THERE, as a page of this site.
//
// It was the one page drawn outside the house: the root not-found, above the
// site's layout, so it had no header, no footer and no picture — a column of
// text on a flat ground, on a site where every other address opens on a room.
// A mistyped address or a link to a layout that has since closed is still a
// visitor, usually one looking for a particular layout.
//
// So an unmatched address is caught INSIDE the site now (the catch-all route
// in the experience group), and what it is shown is a folio like any other:
// the hall behind it (places.ts gives an unknown route the hall), the film's
// header, the film's ending under it, and — as before — not an apology and
// not a search box we do not have, but the places the thing they wanted could
// actually be.
//
// `bare` is for the two not-found boundaries that are outside the canvas (the
// site group's, for a plot that does not exist; the root's, as a last resort):
// the same page with no picture behind its plate.

import { Folio, Gilt, IndexList, Plate, Prose, Sheet } from './Folio';
import { TabTitle } from './FolioClient';
import { COMPANY } from '@/lib/company';
import { sitePage } from '@/components/site/siteMap';

/** What the tab reads on a page that is not there (the not-found routes'
 *  own metadata says the same; FolioClient's TabTitle says why it is here). */
export const NOT_FOUND_TITLE = 'Page not found — Quality Homes Reality';

/** Six places the thing they wanted could be: each by the one name it has
 *  everywhere (siteMap.ts), with a line written for somebody who is lost. */
const WAYS = [
  { href: '/projects', line: 'Every plotted layout that is open, each with its plan.' },
  { href: '/properties', line: 'Sizes and road widths, side by side.' },
  { href: '/downloads', line: 'All three layout plans, as files.' },
  { href: '/contact', line: 'The branch that holds the site answers.' },
  { href: '/', line: 'The whole site, from the gate.' },
  { href: '/sitemap', line: 'The whole site on one sheet.' },
].map((w) => ({ ...w, name: sitePage(w.href)!.name }));

export function NotFoundFolio({ bare = false }: { bare?: boolean }) {
  return (
    <Folio>
      <TabTitle title={NOT_FOUND_TITLE} />
      <div className={bare ? 'folio-bare' : undefined}>
        <Plate
          short
          kicker="404"
          title={
            <>
              That page <Gilt>isn&rsquo;t here.</Gilt>
            </>
          }
          lede="The address may have changed, or the layout may have closed. Everything we have open is one step away."
          cue={{ label: 'Where it may be', href: '#ways' }}
        />
      </div>

      <Sheet
        id="ways"
        first
        kicker="Where it may be"
        title={
          <>
            Six places <Gilt>to look.</Gilt>
          </>
        }
      >
        <IndexList two items={WAYS} />
        <div className="mt-12">
          <Prose>
            <p>
              Or call the head office on <a href={COMPANY.phone.href}>{COMPANY.phone.display}</a>.
            </p>
          </Prose>
        </div>
      </Sheet>
    </Folio>
  );
}
