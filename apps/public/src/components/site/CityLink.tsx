'use client';

// apps/public/src/components/site/CityLink.tsx
//
// One project in the district-field chapter's list, and the bridge between that
// list and the marker standing for it in the scene.
//
// WHY THE KEYBOARD PATH IS A DOM LINK AND NOT A FOCUSABLE BEACON
//
// The canvas is aria-hidden — deliberately, and since long before this chapter
// existed: it is a backdrop, and every word a screen reader needs is in the page
// above it. Putting a focusable control INSIDE an aria-hidden subtree is not an
// accessibility win, it is a defect: the focus ring lands somewhere the
// accessibility tree says does not exist, and a screen reader announces nothing.
//
// So the list is the interactive layer and the beacon is its rendering. Focus or
// hover a project here and its marker lifts in the field; press Enter and the
// route is the same veiled client-side push the marker's own click performs.
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
 * Which beacon is lit from the DOM.
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
      <span className="t-h3 block text-[#F2EDE4] transition-colors group-hover:text-[#E8B98A] group-focus-visible:text-[#E8B98A]">
        {name}
      </span>
      {place ? <span className="t-body mt-1 block text-[#F2EDE4]/55">{place}</span> : null}
      <span className="t-eyebrow mt-2 block text-[#F2EDE4]/45">
        {available} of {total} plots open
      </span>
    </Link>
  );
}
