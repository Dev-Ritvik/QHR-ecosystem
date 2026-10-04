'use client';

// apps/public/src/components/site/CityLink.tsx
//
// One project in the map table chapter's list, and the bridge between that
// list and the pin standing for it on the table (MapTable.tsx).
//
// WHY THE KEYBOARD PATH IS A DOM LINK AND NOT A FOCUSABLE BEACON
//
// The canvas is aria-hidden — deliberately, and since long before this chapter
// existed: it is a backdrop, and every word a screen reader needs is in the page
// above it. Putting a focusable control INSIDE an aria-hidden subtree is not an
// accessibility win, it is a defect: the focus ring lands somewhere the
// accessibility tree says does not exist, and a screen reader announces nothing.
//
// So the list is the interactive layer and the pin is its rendering. Focus or
// hover a project here and its pin lifts on the table; press Enter and the
// route is the same veiled client-side push the pin's own click performs.
// A visitor on a keyboard gets the identical destination, the identical
// transition, and — because the marker responds — the identical feedback.

import Link from 'next/link';
import { create } from 'zustand';

interface BeaconFocusState {
  /** The slug the visitor is pointing at or focused on, or null. */
  slug: string | null;
  set: (slug: string | null) => void;
}

/**
 * Which pin on the map table is lit from the DOM.
 *
 * A store rather than a prop for the same reason useSceneCards is one: the list
 * lives in the page and the field lives in the layout's canvas, and there is no
 * prop path between them.
 */
export const useBeaconFocus = create<BeaconFocusState>((set) => ({
  slug: null,
  set: (slug) => set({ slug }),
}));

export function CityLink({
  slug,
  name,
  locality,
  city,
  available,
  total,
}: {
  slug: string;
  name: string;
  locality: string | null;
  city: string | null;
  available: number;
  total: number;
}) {
  const setFocus = useBeaconFocus((s) => s.set);
  const place = [locality, city].filter(Boolean).join(' · ');

  return (
    <Link
      href={`/projects/${slug}`}
      className="tap-target group block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#E8B98A]"
      onMouseEnter={() => setFocus(slug)}
      onMouseLeave={() => setFocus(null)}
      onFocus={() => setFocus(slug)}
      onBlur={() => setFocus(null)}
    >
      {/* One step below the chapter's statement, on the scale: the chapter
          carries an eyebrow, a heading, every published project and a note, and
          the pane is a centred sticky frame, so a list taller than a 390x844
          viewport would be CLIPPED rather than scrollable. */}
      <span className="block text-step-1 text-[#F2EDE4] transition-colors group-hover:text-[#E8B98A] group-focus-visible:text-[#E8B98A]">
        {name}
      </span>
      {/* Not on a phone: there the list has the height between the header and
          the table and no more (a phone's frame is about 390x664 with its
          browser's bars showing; measured at 375x667), and the place is on the
          table's own copy two chapters back. By width, not by height: a
          phone's height changes as its bars come and go, and a line that
          appeared and vanished with them would jump the list. */}
      {place ? <span className="t-small mt-1 block text-[#F2EDE4] short:sr-only max-md:hidden">{place}</span> : null}
      {/* In words, not in tracked capitals (StationText: the same line). */}
      <span className="t-small mt-1 block text-[#F2EDE4]/95">
        {available} of {total} plots open
      </span>
    </Link>
  );
}
