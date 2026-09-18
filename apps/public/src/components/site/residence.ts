// apps/public/src/components/site/residence.ts
//
// Where the visitor was in the film, remembered across a trip out of it.
//
// The address bar already carries the chapter while the film is on screen, but
// the moment a visitor opens a project page that fragment is gone — the URL is
// now the project's. So returning had only two options: back to the very top,
// or the browser's back button. The first throws away everything they had
// watched; the second is not an affordance, it is a browser control, and it
// does not exist as a thing on the page.
//
// sessionStorage rather than localStorage, deliberately. This is one visit's
// position in one film. A visitor who comes back next week should get the
// opening shot, not be dropped three quarters of the way through a sequence
// they no longer remember. It also means nothing here survives the tab, which
// is the right lifetime for something this incidental — and it is not personal
// data by any reading.
//
// Every access is wrapped: Safari's private mode throws on sessionStorage
// access rather than returning null, and a header that throws is a header that
// takes the whole page with it.

const KEY = 'qhr.residence.chapter';

/** Remember the chapter currently on screen. Silent on failure by design. */
export function rememberChapter(id: string): void {
  try {
    window.sessionStorage.setItem(KEY, id);
  } catch {
    /* private mode, storage disabled, quota — none of it is worth an error */
  }
}

/** The chapter to resume at, or null if this visit has not reached one. */
export function rememberedChapter(): string | null {
  try {
    const v = window.sessionStorage.getItem(KEY);
    return v && v.length > 0 && v.length < 64 ? v : null;
  } catch {
    return null;
  }
}

/**
 * A human name for a chapter, for the return link's label.
 *
 * Deliberately generic where the film is specific: the station chapters are one
 * label rather than three, because "resume at the second table" is a promise
 * about a camera position that the visitor has no way to verify from a header,
 * and because naming them would mean reading project data into the site chrome.
 * The link says where the film picks up, not which frame.
 */
export function chapterLabel(id: string): string {
  if (id.startsWith('station-')) return 'the tables';
  switch (id) {
    case 'hero':
      return 'the arrival';
    case 'revolution':
      return 'the house';
    case 'constellation':
      return 'the constellation';
    case 'approach':
      return 'the front door';
    case 'establish':
      return 'the hall';
    case 'portrait':
      return 'the portrait';
    default:
      return 'where you were';
  }
}

/**
 * The href that resumes the film.
 *
 * `hero` returns the bare path on purpose: it is the top of the page, and
 * `/#hero` would be a fragment that scrolls to where the browser already is.
 */
export function residenceHref(id: string | null): string {
  if (!id || id === 'hero') return '/';
  return `/#${id}`;
}
