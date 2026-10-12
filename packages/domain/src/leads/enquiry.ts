// packages/domain/src/leads/enquiry.ts
//
// WHAT A WEBSITE ENQUIRY SAID, KEPT WHOLE.
//
// The intake kept sixty characters of an enquiry's message, in the column for
// how soon a buyer means to buy (`timeline_expectation`), and nothing else the
// visitor sent: not the time of day they asked to be called, not the day they
// asked to walk the land, not the layout when the form named one the register
// could not match. A branch that picked the enquiry up read a clipped line and
// had to ring to ask what the form had already been told.
//
// The lead's row has one column that is free text and unbounded
// (`source_detail`: for a referral, who referred; for the website, what was
// sent). So an enquiry is described twice here, from the same payload:
//
//   head    the line a branch reads on the lead's card in the inbox. Sixty
//           characters, because that is the column it has always been shown
//           from; the site composes a visit's own head ("Site visit · Sat 10
//           Oct · morning · Lucky Garden") and it is kept as sent.
//   detail  everything, one fact a line, in the order it is acted on: that it
//           is a visit and for which day; the layout; when to telephone; the
//           visitor's own words; the page it came from.
//
// Pure, and it trusts nothing: every field is whatever arrived, so each is
// taken only if it is the kind of thing it says it is, stripped of control
// characters and cut to a length.

export const ENQUIRY_HEAD_MAX = 60;
export const ENQUIRY_DETAIL_MAX = 2000;

export interface EnquiryPayload {
  kind?: unknown;
  message?: unknown;
  /** The visitor's own words, apart from anything the site composed round them. */
  note?: unknown;
  preferredTime?: unknown;
  /** YYYY-MM-DD. */
  visitDate?: unknown;
  visitTime?: unknown;
  layoutName?: unknown;
  /** The path of the page the form was on. */
  page?: unknown;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

const TIME_OF_DAY: Readonly<Record<string, string>> = {
  morning: 'in the morning',
  afternoon: 'in the afternoon',
  evening: 'in the evening',
  any: 'at any time of day',
};

function text(v: unknown, max: number): string {
  if (typeof v !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return v.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** "2026-10-10" as "Saturday 10 October 2026"; anything that is not a real
 *  calendar date is "". */
export function longDay(v: unknown): string {
  if (typeof v !== 'string') return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
  if (!m) return '';
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return '';
  return `${DAYS[date.getUTCDay()]} ${d} ${MONTHS[mo - 1]} ${y}`;
}

export function describeEnquiry(p: EnquiryPayload): { head: string | null; detail: string | null } {
  const visit = p.kind === 'site_visit';
  const message = text(p.message, 1500);
  const note = text(p.note, 1500);
  const layout = text(p.layoutName, 80);
  const day = longDay(p.visitDate);
  const visitTime = typeof p.visitTime === 'string' ? TIME_OF_DAY[p.visitTime] ?? '' : '';
  const callTime = typeof p.preferredTime === 'string' ? TIME_OF_DAY[p.preferredTime] ?? '' : '';
  const page = text(p.page, 120);

  const lines: string[] = [];
  if (visit) {
    lines.push(`Asked to visit the site: ${day || 'no day named'}${visitTime ? `, ${visitTime}` : ''}.`);
  }
  if (layout) lines.push(`Layout: ${layout}.`);
  // On a visit the time of day chosen is the visit's, and is said above.
  if (!visit && callTime) lines.push(`Asked to be telephoned ${callTime}.`);
  // The visitor's own words: `note` where the site sent them apart; otherwise
  // the message, which on an older site is all there is.
  const said = note || (visit ? '' : message);
  if (said) lines.push(`They wrote: ${said}`);
  if (page.startsWith('/')) lines.push(`Sent from ${page}.`);

  const detail = lines.join('\n').slice(0, ENQUIRY_DETAIL_MAX);
  const head = (message || (visit ? `Site visit${day ? ` · ${day}` : ''}` : '')).slice(0, ENQUIRY_HEAD_MAX);
  return { head: head || null, detail: detail || null };
}
