// apps/public/src/app/(site)/enquiryMessage.ts
//
// WHAT THE BRANCH READS FIRST.
//
// An enquiry reaches the CRM with one line of free text, and the CRM keeps the
// head of that line where the person who picks the enquiry up sees it (sixty
// characters, on the lead's card). A request to walk a layout on a named day
// is not a different kind of record there: it is an enquiry whose line says
// so. So the line is composed here, with what matters at its head — that it
// is a visit, the day, the time of day, the layout — and whatever the visitor
// wrote after it. The longest head this can make ("Site visit · Sat 10 Oct ·
// afternoon · VSR Gayatri Township") is 58 characters.
//
// Pure, so the wording a branch will read is tested as arithmetic and not by
// sending an enquiry.

export type VisitTime = 'any' | 'morning' | 'afternoon' | 'evening';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** "2026-10-10" as "Sat 10 Oct". Anything that is not a real date is "". */
export function visitDay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return '';
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  // In UTC, so the day of the week is the calendar's and not the server's.
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return '';
  return `${DAYS[date.getUTCDay()]} ${d} ${MONTHS[mo - 1]}`;
}

export function composeMessage({
  visit,
  date,
  time,
  layout,
  note,
}: {
  visit: boolean;
  /** As a date field gives it: YYYY-MM-DD, or empty. */
  date: string;
  time: VisitTime;
  layout: string;
  note: string;
}): string {
  const said = note.trim();
  if (!visit) return said;
  const head = ['Site visit', visitDay(date) || 'day open', time === 'any' ? 'any time' : time, layout.trim()]
    .filter(Boolean)
    .join(' · ');
  return said ? `${head} — ${said}` : head;
}
