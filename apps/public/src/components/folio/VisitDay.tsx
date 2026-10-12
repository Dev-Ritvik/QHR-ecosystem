'use client';

// apps/public/src/components/folio/VisitDay.tsx
//
// THE DAY OF A VISIT, drawn as the form is drawn (the forensic audit of
// 2026-10-09, #109). It was the browser's own date field: "dd-mm-yyyy" in the
// browser's layout, the browser's calendar icon, a bright blue selection on
// the part being typed — "every other field is drawn in the site's style;
// this one is the operating system's".
//
// A line like the form's other lines, which says the day in words; pressed, it
// opens a month under it — the month's days as a table of buttons — and a day
// pressed is written on the line. Nothing is typed, so there is no format to
// get wrong, and the day's name (a visit is "this Saturday" before it is a
// number) is on the page from the start.
//
// What the form sends is what the date field sent: `YYYY-MM-DD` in a field
// named as the caller says, or nothing if the day is left open.

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/**
 * How far ahead a day may be asked for: the months after this one. Eleven, so
 * that no month comes round twice in what is offered — and the line can say a
 * day without its year ("Saturday 17 October"), which is how a day is said.
 */
export const MONTHS_AHEAD = 11;

const pad = (n: number) => String(n).padStart(2, '0');

/** A day as the form sends it, in the visitor's own calendar. */
export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** A day in full, as a screen reader is given each one: "Saturday 17 October 2026". */
export function dayInWords(d: Date): string {
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** A day as the form's line writes the one chosen: "Saturday 17 October". */
export function dayOnTheLine(d: Date): string {
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function atNoon(y: number, m: number, d: number): Date {
  // Noon, so that a day added or taken never lands on the wrong side of a
  // clock change.
  return new Date(y, m, d, 12);
}

function addDays(d: Date, n: number): Date {
  return atNoon(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** The same day of another month, or that month's last day if it is shorter. */
function addMonths(d: Date, n: number): Date {
  const first = atNoon(d.getFullYear(), d.getMonth() + n, 1);
  const last = atNoon(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return atNoon(first.getFullYear(), first.getMonth(), Math.min(d.getDate(), last));
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** A month as rows of seven, Sunday first; a gap is null. */
export function monthRows(year: number, month: number): (Date | null)[][] {
  const lead = atNoon(year, month, 1).getDay();
  const days = atNoon(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(atNoon(year, month, d));
  while (cells.length % 7) cells.push(null);
  const rows: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

interface VisitDayProps {
  /** The field's name in the form. */
  name: string;
  /** The id its label points at. */
  id: string;
  /** The id of that label, read with the day as the control's name. */
  labelId: string;
  onFocus?: () => void;
}

export function VisitDay({ name, id, labelId, onFocus }: VisitDayProps) {
  const uid = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const grid = useRef<HTMLTableElement>(null);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<Date | null>(null);
  /** The day the keyboard is on, and so the month that is shown. */
  const [cursor, setCursor] = useState<Date | null>(null);
  /** Set when the keyboard moved the day: the new day's button takes focus. */
  const follow = useRef(false);

  // Today is the visitor's, read when the month is opened: never on the
  // server, whose day may be another.
  const [today, setToday] = useState<Date | null>(null);
  const last = useMemo(
    () => (today ? atNoon(today.getFullYear(), today.getMonth() + MONTHS_AHEAD + 1, 0) : null),
    [today],
  );

  const clamp = useCallback(
    (d: Date): Date => {
      if (today && d < today) return today;
      if (last && d > last) return last;
      return d;
    },
    [today, last],
  );

  const show = useCallback(() => {
    const now = new Date();
    const t = atNoon(now.getFullYear(), now.getMonth(), now.getDate());
    setToday(t);
    setCursor(value && value >= t ? value : t);
    setOpen(true);
  }, [value]);

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  }, []);

  // Closed by going elsewhere: a press or a focus outside it. (Not by a blur:
  // a browser that does not focus a button it is clicked on would report the
  // press of a day as leaving, and close the month under the pointer.)
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => {
      if (root.current && e.target instanceof Node && !root.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    document.addEventListener('focusin', away);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('focusin', away);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !follow.current || !cursor) return;
    follow.current = false;
    grid.current?.querySelector<HTMLElement>(`[data-day="${isoDay(cursor)}"]`)?.focus();
  }, [open, cursor]);

  const move = useCallback(
    (to: Date) => {
      follow.current = true;
      setCursor(clamp(to));
    },
    [clamp],
  );

  const onGridKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (!cursor) return;
      let to: Date | null = null;
      if (e.key === 'ArrowLeft') to = addDays(cursor, -1);
      else if (e.key === 'ArrowRight') to = addDays(cursor, 1);
      else if (e.key === 'ArrowUp') to = addDays(cursor, -7);
      else if (e.key === 'ArrowDown') to = addDays(cursor, 7);
      else if (e.key === 'Home') to = addDays(cursor, -cursor.getDay());
      else if (e.key === 'End') to = addDays(cursor, 6 - cursor.getDay());
      else if (e.key === 'PageUp') to = addMonths(cursor, -1);
      else if (e.key === 'PageDown') to = addMonths(cursor, 1);
      if (!to) return;
      e.preventDefault();
      move(to);
    },
    [cursor, move],
  );

  const choose = useCallback(
    (d: Date | null) => {
      setValue(d);
      close(true);
    },
    [close],
  );

  const shown = cursor ?? today;
  const rows = useMemo(() => (shown ? monthRows(shown.getFullYear(), shown.getMonth()) : []), [shown]);
  const atFirst = Boolean(shown && today && shown.getFullYear() === today.getFullYear() && shown.getMonth() === today.getMonth());
  const atLast = Boolean(shown && last && shown.getFullYear() === last.getFullYear() && shown.getMonth() === last.getMonth());
  const page = (n: number) => {
    if (!shown) return;
    // The first day of that month that can be asked for.
    const first = atNoon(shown.getFullYear(), shown.getMonth() + n, 1);
    setCursor(clamp(first));
  };

  const valueId = `${uid}-value`;
  const panelId = `${uid}-panel`;
  const monthId = `${uid}-month`;

  return (
    <div
      ref={root}
      className={'visit-day' + (open ? ' is-open' : '')}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation();
          close(true);
        }
      }}
    >
      <input type="hidden" name={name} value={value ? isoDay(value) : ''} />
      <button
        ref={trigger}
        type="button"
        id={id}
        className="visit-day-line"
        aria-expanded={open}
        aria-controls={panelId}
        aria-labelledby={`${labelId} ${valueId}`}
        onFocus={onFocus}
        onClick={() => (open ? close(false) : show())}
      >
        <span id={valueId} className={value ? undefined : 'is-open-day'}>
          {value ? dayOnTheLine(value) : 'Any day'}
        </span>
        <span className="visit-day-mark" aria-hidden />
      </button>

      {open && shown ? (
        <div id={panelId} className="visit-day-month" role="group" aria-labelledby={monthId}>
          <div className="visit-day-head">
            <p id={monthId} aria-live="polite">
              {MONTHS[shown.getMonth()]} {shown.getFullYear()}
            </p>
            <button type="button" className="visit-day-turn" aria-label="The month before" disabled={atFirst} onClick={() => page(-1)}>
              <span className="visit-day-arrow is-back" aria-hidden />
            </button>
            <button type="button" className="visit-day-turn" aria-label="The month after" disabled={atLast} onClick={() => page(1)}>
              <span className="visit-day-arrow" aria-hidden />
            </button>
          </div>
          <table ref={grid} className="visit-day-grid" role="grid" aria-labelledby={monthId} onKeyDown={onGridKey}>
            <thead>
              <tr>
                {WEEKDAYS.map((w) => (
                  <th key={w} scope="col" abbr={w}>
                    {w.slice(0, 2)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r}>
                  {row.map((d, c) => {
                    if (!d) return <td key={c} />;
                    const past = Boolean((today && d < today) || (last && d > last));
                    const chosen = Boolean(value && sameDay(d, value));
                    return (
                      <td key={c}>
                        <button
                          type="button"
                          data-day={isoDay(d)}
                          aria-label={dayInWords(d)}
                          aria-pressed={chosen}
                          aria-current={today && sameDay(d, today) ? 'date' : undefined}
                          disabled={past}
                          tabIndex={cursor && sameDay(d, cursor) ? 0 : -1}
                          onClick={() => choose(d)}
                        >
                          {d.getDate()}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {value ? (
            <button type="button" className="visit-day-clear" onClick={() => choose(null)}>
              Any day will do
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
