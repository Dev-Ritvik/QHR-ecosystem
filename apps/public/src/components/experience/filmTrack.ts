// apps/public/src/components/experience/filmTrack.ts
//
// What a scroll fraction is measured AGAINST.
//
// THE DEFECT THIS FIXES. The camera, the chapter address and the tests all read
// progress as `scrollY / (document height - viewport)`. The chapter sections are
// sized as fractions of TRACK_VH. Those are two different denominators: the
// document also carries the held frame after the film, the sold-out list and a
// footer, so the same fraction lands at two different places on the page.
// MEASURED on the 2220vh track at 1440x900: the camera reached the first table
// at 11,590px and left it at 12,552px, and that table's copy pinned at 12,705px —
// the name of the first project arrived while the camera was framing the second.
// On the old 1700vh track the same error was 713px and merely late; growing the
// track grew it, because the tail it comes from is a fixed height.
//
// So the film is measured against the film. The home page marks where its track
// ends (`data-film-end`, carrying the fraction that point stands for), and a
// fraction of the track is a fraction of THAT length. A section then begins at
// exactly the scroll position its chapter does, by construction, whatever
// follows the film on the page.
//
// Every other page has no marker and keeps the document measure, which is the
// right answer for a page that is not a film.

/** Scroll distance, in pixels, that progress 1.0 stands for. */
export function measureFilmSpan(): number {
  const fallback = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  const markers = document.querySelectorAll<HTMLElement>('[data-film-end]');
  let best = 0;
  let span = 0;
  markers.forEach((m) => {
    const fraction = Number(m.dataset.filmEnd);
    if (!(fraction > 0) || fraction < best) return;
    const y = m.getBoundingClientRect().top + window.scrollY;
    if (y <= 0) return;
    best = fraction;
    span = y / fraction;
  });
  return span > 1 ? span : fallback;
}
