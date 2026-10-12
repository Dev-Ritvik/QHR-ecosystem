// apps/public/src/components/folio/Folio.tsx
//
// THE FOLIO: what every page that is not the film is made of.
//
// A plate, sheets, windows, and the way on (app/folio.css has the account).
// These are plain server components — a folio is real, server-rendered HTML
// with its headings in order, and it reads whole with no script and no canvas.
// The three things that need a browser are one small client leaf each
// (FolioClient.tsx): the rail of the page's sections, the reveal of what is
// read as it comes into the frame, and the header's ground.
//
// ONE VOCABULARY, SO THE PAGES ARE ONE HOUSE. A page does not choose its own
// column, its own heading size or its own rule: it says what it has — a
// statement, a ledger, a run of steps, a list of places to go — and these set
// it. That is what "the same vibe" is made of.

import Link from 'next/link';
import type { ReactNode } from 'react';
import { FolioChrome } from './FolioClient';
import { PaperLink } from './PlanViewer';

// ── the page ────────────────────────────────────────────────────────────────

export function Folio({ children }: { children: ReactNode }) {
  return (
    <main className="folio">
      <FolioChrome />
      {children}
    </main>
  );
}

// ── the plate ───────────────────────────────────────────────────────────────

interface PlateProps {
  /** Where this page sits in the site: its part, in a few words. */
  kicker?: string;
  /** The page's title: one statement. Put the phrase it turns on in <Gilt>. */
  title: ReactNode;
  /** One supporting sentence. */
  lede?: ReactNode;
  /** The word under the cue at the plate's foot, and where it leads. */
  cue?: { label: string; href: string };
  /** Anything else at the plate's foot (an action). */
  children?: ReactNode;
  /** A long title: a wider measure. */
  long?: boolean;
  /** A page whose business is below the plate: a shorter one. */
  short?: boolean;
}

export function Plate({ kicker, title, lede, cue, children, long, short }: PlateProps) {
  return (
    <header className={'folio-plate' + (short ? ' is-short' : '')} data-folio-plate>
      {/* The copy and the density it stands on are one block (folio.css,
          .folio-plate-copy): the density is sized by the words, so a long
          title has as much ground under its last line as a short one. */}
      <div className="folio-plate-copy">
        {/* The words by themselves, apart from the density they stand on: as
            the page is scrolled they go up under the header, which over a
            plate is air, and they are dissolved before they reach it
            (folio.css, .folio-plate-words; FolioClient measures where). */}
        <div className="folio-plate-words">
          {kicker ? <p className="folio-kicker">{kicker}</p> : null}
          <h1 className={'t-d1 folio-title' + (long ? ' is-long' : '')}>{title}</h1>
          {lede ? <p className="t-support folio-lede">{lede}</p> : null}
          {cue || children ? (
            <div className="folio-plate-foot">
              {cue ? (
                <a className="folio-cue" href={cue.href}>
                  <i aria-hidden />
                  <span>{cue.label}</span>
                </a>
              ) : null}
              {children}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

/** The phrase a display line turns on: the house's gilt, in the same roman. */
export function Gilt({ children }: { children: ReactNode }) {
  return <span className="t-gilt">{children}</span>;
}

// ── the sheets ──────────────────────────────────────────────────────────────

interface SheetProps {
  /** The section's anchor. */
  id: string;
  /** What the rail calls it. Omit to leave it off the rail. */
  rail?: string;
  /** A few words over the title. */
  kicker?: string;
  /** The section's title. */
  title?: ReactNode;
  /** A sentence under the title, in the margin. */
  note?: ReactNode;
  children: ReactNode;
  /** `full`: the title across the top and the body the sheet's full width.
   *  `even`: two equal columns. Default: the title in the margin. */
  layout?: 'spread' | 'even' | 'full';
  /** A lifted plane, for a sheet that should stand apart. */
  raised?: boolean;
  /** The first sheet under a plate: it rises out of the plate's foot. */
  first?: boolean;
}

/**
 * A SECOND-LEVEL HEADING ENDS AS A SENTENCE DOES (the forensic audit of
 * 2026-10-09, #78). Every page's title ends with a full stop, and no
 * third-level heading does; the level between did eighty times and did not
 * thirty-two — the legal pages' ("Who is responsible" beside "What we collect,
 * and when."), the sitemap's parts, a layout's name where it heads its own
 * section. "The full stop is part of the site's voice; applied unevenly it
 * looks like two writers." So the rule is held where the heading is drawn: a
 * title given as plain words is closed if it was not, whoever wrote it and
 * wherever its words came from (a layout's name comes from the register).
 */
export function closed(title: ReactNode): ReactNode {
  return typeof title === 'string' && !/[.?!]$/.test(title.trim()) ? `${title.trim()}.` : title;
}

export function Sheet({ id, rail, kicker, title, note, children, layout = 'spread', raised, first }: SheetProps) {
  const cls =
    'folio-sheet' +
    (layout === 'full' ? ' is-full' : '') +
    (raised ? ' is-raised' : '') +
    (first ? ' is-first' : '');
  return (
    <section id={id} className={cls} data-rail={rail} aria-labelledby={title ? `${id}-title` : undefined}>
      <div className={'folio-spread' + (layout === 'even' ? ' is-even' : '')}>
        {title || kicker ? (
          <div className="folio-head" data-reveal>
            {kicker ? <p className="folio-kicker">{kicker}</p> : null}
            {title ? (
              <h2 id={`${id}-title`} className="t-d3">
                {closed(title)}
              </h2>
            ) : null}
            {note ? <p className="folio-head-note">{note}</p> : null}
          </div>
        ) : null}
        <div className="folio-body">{children}</div>
      </div>
    </section>
  );
}

/** Reading text: paragraphs at a reading size on a reading measure. */
export function Prose({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={'folio-prose' + (className ? ` ${className}` : '')} data-reveal>
      {children}
    </div>
  );
}

/** A quieter paragraph: a caveat, a source, what is not claimed. */
export function Note({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p className={'folio-note' + (className ? ` ${className}` : '')} data-reveal>
      {children}
    </p>
  );
}

// ── figures, ledgers, steps, lists ──────────────────────────────────────────

export interface FigureItem {
  value: string;
  unit?: string;
  label: string;
}

export function Figures({ items }: { items: FigureItem[] }) {
  return (
    <dl className="folio-figures" data-n={items.length}>
      {items.map((f, i) => (
        <div key={f.label} className="folio-figure" data-reveal style={{ ['--i' as string]: i }}>
          <dt>
            {f.value}
            {/* (A space, so that it is "40 ft" to whoever copies it or has
                it read out; in the unit's size, so it is the gap it was.) */}
            {f.unit ? <small> {f.unit}</small> : null}
          </dt>
          <dd>{f.label}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Ledger({ rows }: { rows: { term: string; value: ReactNode }[] }) {
  return (
    <dl className="folio-ledger" data-reveal>
      {rows.map((r) => (
        <div key={r.term}>
          <dt>{r.term}</dt>
          <dd>{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Steps({ children }: { children: ReactNode }) {
  return <ol className="folio-steps">{children}</ol>;
}

export function Step({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <li className="folio-step" data-reveal>
      <h3>{title}</h3>
      {children}
    </li>
  );
}

export interface IndexItem {
  href?: string;
  name: ReactNode;
  line?: ReactNode;
  meta?: ReactNode;
  /** A file to save rather than a page to open. */
  download?: boolean;
  external?: boolean;
}

/** A list of places to go: a name, a line about it, and what it is. */
export function IndexList({ items, two }: { items: IndexItem[]; two?: boolean }) {
  return (
    <ul className={'folio-index' + (two ? ' is-two' : '')}>
      {items.map((it, i) => {
        const inner = (
          <>
            <span className="folio-index-name">{it.name}</span>
            {it.line ? <span className="folio-index-line">{it.line}</span> : null}
            {it.meta && !two ? <span className="folio-index-meta">{it.meta}</span> : null}
          </>
        );
        return (
          <li key={i} data-reveal style={{ ['--i' as string]: Math.min(i, 6) }}>
            {it.href ? (
              it.download || it.external ? (
                <a
                  href={it.href}
                  download={it.download || undefined}
                  target={it.external ? '_blank' : undefined}
                  rel={it.external ? 'noreferrer noopener' : undefined}
                >
                  {inner}
                </a>
              ) : (
                <Link href={it.href}>{inner}</Link>
              )
            ) : (
              <div>{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** A plain list, a line a thing, ruled between: what is there, set down. */
export function List({ items, className = '' }: { items: ReactNode[]; className?: string }) {
  return (
    <ul className={'folio-list' + (className ? ` ${className}` : '')}>
      {items.map((it, i) => (
        <li key={i} data-reveal style={{ ['--i' as string]: Math.min(i, 6) }}>
          {it}
        </li>
      ))}
    </ul>
  );
}

/** Rows and columns: sizes against areas, a cookie against its purpose. */
export function Table({
  head,
  rows,
  caption,
  numeric = [],
  keep = [],
}: {
  head: string[];
  rows: ReactNode[][];
  caption?: string;
  /** Columns set in tabular figures, ranged right. */
  numeric?: number[];
  /** Columns of a few words that keep to one line: their width is their
   *  content's, and the long column beside them has the rest. */
  keep?: number[];
}) {
  const cell = (i: number) => [numeric.includes(i) ? 'is-num' : '', keep.includes(i) ? 'is-keep' : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div className="folio-table-wrap" data-reveal>
      <table className="folio-table">
        {caption ? <caption>{caption}</caption> : null}
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={h} scope="col" className={cell(i)}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
              {r.map((c, ci) =>
                ci === 0 ? (
                  <th key={ci} scope="row">
                    {c}
                  </th>
                ) : (
                  // (data-label: on a phone a row is a block, and each cell is
                  // read under its column's name — folio.css.)
                  <td key={ci} data-label={head[ci]} className={cell(ci)}>
                    {c}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Questions and their answers, a question a row. */
export function QA({ items }: { items: { q: string; a: ReactNode }[] }) {
  return (
    <dl className="folio-qa">
      {items.map((it, i) => (
        <div key={it.q} data-reveal style={{ ['--i' as string]: Math.min(i, 4) }}>
          <dt>{it.q}</dt>
          <dd>{it.a}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Somebody's own words, at length: set large, with whose they are. */
export function Quote({ children, by, where }: { children: ReactNode; by: string; where?: string }) {
  return (
    <figure className="folio-quote" data-reveal>
      <blockquote>{children}</blockquote>
      <figcaption>
        <span>{by}</span>
        {where ? <span>{where}</span> : null}
      </figcaption>
    </figure>
  );
}

// ── drawings ────────────────────────────────────────────────────────────────

/**
 * A drawing on paper, whole: a sanctioned plan. Ivory, as a sheet is, and it
 * opens at its full size in its own tab — a plan is read with the nose to it.
 * (A plain <img>: the plans are served as they were drawn, and the full-size
 * file the link opens is this same file, already fetched.)
 */
export function Paper({
  src,
  w,
  h,
  alt,
  caption,
  eager,
}: {
  src: string;
  w: number;
  h: number;
  alt: string;
  caption?: ReactNode;
  eager?: boolean;
}) {
  return (
    <figure className="folio-figure-paper" data-reveal style={{ ['--paper-ratio' as string]: (w / h).toFixed(4) }}>
      {/* The sheet opens over its own page, to be looked at closely
          (PlanViewer.tsx): the forensic audit of 2026-10-09, #64. */}
      <PaperLink src={src} w={w} h={h} alt={alt}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={w} height={h} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" />
      </PaperLink>
      {caption ? <figcaption className="folio-caption">{caption}</figcaption> : null}
    </figure>
  );
}

/**
 * A part of a drawing, enlarged: the thing the text beside it is talking
 * about, shown on the sheet it is printed on. `focus` is where on the sheet to
 * look (percent across, percent down), and `zoom` how many times its width is
 * enlarged; the frame is centred on that point, or as near as the sheet's
 * edge allows. (`background-position` in percent aligns a point of the image
 * with the same point of the frame, so the arithmetic is done here and a page
 * says only where to look.)
 */
export function Detail({
  src,
  w,
  h,
  focus,
  zoom = 3,
  ratio = 4 / 3,
  alt,
  caption,
}: {
  src: string;
  /** The drawing's own size, for its proportions. */
  w: number;
  h: number;
  focus: [number, number];
  zoom?: number;
  /** The frame's width over its height. */
  ratio?: number;
  alt: string;
  caption?: ReactNode;
}) {
  const seenW = 1 / zoom;
  const seenH = w / h / (zoom * ratio);
  const place = (at: number, seen: number) =>
    seen >= 1 ? 50 : Math.min(100, Math.max(0, ((at / 100 - seen / 2) / (1 - seen)) * 100));
  return (
    <figure className="folio-detail" data-reveal>
      <div
        role="img"
        aria-label={alt}
        className="folio-paper"
        style={{
          aspectRatio: String(ratio),
          backgroundImage: `url(${src})`,
          backgroundSize: `${zoom * 100}% auto`,
          backgroundPosition: `${place(focus[0], seenW).toFixed(2)}% ${place(focus[1], seenH).toFixed(2)}%`,
        }}
      />
      {caption ? <figcaption className="folio-caption">{caption}</figcaption> : null}
    </figure>
  );
}

// ── the windows ─────────────────────────────────────────────────────────────

/** An opening onto the picture between two sheets, with one line on it. */
export function Window({
  children,
  gloss,
  by,
  lang,
}: {
  children: ReactNode;
  /** The line under it: a translation, or what the line is about. */
  gloss?: ReactNode;
  /** Whose line it is, or what it is a line of. */
  by?: ReactNode;
  lang?: string;
}) {
  return (
    <figure className="folio-window">
      <div className="folio-window-copy" data-reveal>
        <blockquote className="t-d2" lang={lang}>
          {children}
        </blockquote>
        {gloss ? <p className="t-support folio-window-gloss">{gloss}</p> : null}
        {by ? <figcaption>{by}</figcaption> : null}
      </div>
    </figure>
  );
}

// ── the way on ──────────────────────────────────────────────────────────────

/** The page's last thing: where the story goes next. */
export function NextPage({ href, kicker = 'Next', title, line }: { href: string; kicker?: string; title: ReactNode; line?: ReactNode }) {
  return (
    <Link href={href} className="folio-next">
      <span className="folio-kicker" data-reveal>
        {kicker}
      </span>
      <span className="t-d2 folio-next-title" data-reveal style={{ ['--i' as string]: 1 }}>
        {title}
        <span aria-hidden className="folio-next-arrow">
          &rarr;
        </span>
      </span>
      {line ? (
        <span className="folio-next-line" data-reveal style={{ ['--i' as string]: 2 }}>
          {line}
        </span>
      ) : null}
    </Link>
  );
}

/** A pair of actions under a block. */
export function Actions({ children }: { children: ReactNode }) {
  return (
    <div className="folio-actions" data-reveal>
      {children}
    </div>
  );
}

/** The site's quiet action: a word and a hairline (globals.css, cta-quiet). */
export function Go({ href, children, download }: { href: string; children: ReactNode; download?: boolean }) {
  if (download) {
    return (
      <a href={href} download className="cta-quiet">
        <span className="cta-quiet-label">{children}</span>
      </a>
    );
  }
  return (
    <Link href={href} className="cta-quiet">
      <span className="cta-quiet-label">{children}</span>
    </Link>
  );
}
