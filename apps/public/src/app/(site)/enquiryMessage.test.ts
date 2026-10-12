// apps/public/src/app/(site)/enquiryMessage.test.ts
//
// What a branch reads at the head of an enquiry, tested as arithmetic: the CRM
// keeps the first sixty characters of the line where the person who picks the
// enquiry up sees them, so a visit must say that it is one, for which day and
// for which layout, inside those sixty.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LAYOUTS } from '@/lib/layouts';
import { composeMessage, visitDay, type VisitTime } from './enquiryMessage';

/** What the CRM's intake keeps of an enquiry's line (apps/crm, api/enquiries). */
const KEPT = 60;

describe('a day, as a branch reads it', () => {
  it('says the day of the week, the day and the month', () => {
    expect(visitDay('2026-10-10')).toBe('Sat 10 Oct');
    expect(visitDay('2026-10-07')).toBe('Wed 7 Oct');
    expect(visitDay('2027-01-01')).toBe('Fri 1 Jan');
    expect(visitDay('2028-02-29')).toBe('Tue 29 Feb');
  });

  it('says nothing for a day that is not one', () => {
    for (const bad of ['', '   ', 'tomorrow', '10-10-2026', '2026-13-01', '2026-02-30', '2026-00-10', '2026-10-1']) {
      expect(visitDay(bad), bad).toBe('');
    }
  });

  it('does not move a day across midnight, wherever the server is', () => {
    // parsed and read in UTC: the calendar's day, never the machine's
    expect(visitDay('2026-12-31')).toBe('Thu 31 Dec');
    expect(visitDay('2026-01-01')).toBe('Thu 1 Jan');
  });
});

describe('the line an enquiry carries', () => {
  it('is only what the visitor wrote, for an enquiry', () => {
    expect(composeMessage({ visit: false, date: '2026-10-10', time: 'morning', layout: 'Lucky Garden', note: '  A corner plot?  ' })).toBe(
      'A corner plot?',
    );
    expect(composeMessage({ visit: false, date: '', time: 'any', layout: '', note: '' })).toBe('');
  });

  it('says it is a visit, the day, the time and the layout, before anything the visitor wrote', () => {
    expect(composeMessage({ visit: true, date: '2026-10-10', time: 'morning', layout: 'Lucky Garden', note: 'Two of us.' })).toBe(
      'Site visit · Sat 10 Oct · morning · Lucky Garden — Two of us.',
    );
  });

  it('says so when the day, the time or the layout was left open', () => {
    expect(composeMessage({ visit: true, date: '', time: 'any', layout: '', note: '' })).toBe('Site visit · day open · any time');
    expect(composeMessage({ visit: true, date: 'nonsense', time: 'evening', layout: 'Lucky Garden', note: '' })).toBe(
      'Site visit · day open · evening · Lucky Garden',
    );
  });

  it('fits what matters inside what the CRM keeps, for every layout, day and time', () => {
    const times: VisitTime[] = ['any', 'morning', 'afternoon', 'evening'];
    // the longest a day can be written: a two-figure day in any month
    const days = ['', '2026-09-30', '2026-11-28', '2026-12-23'];
    for (const l of LAYOUTS) {
      for (const time of times) {
        for (const date of days) {
          const head = composeMessage({ visit: true, date, time, layout: l.name, note: '' });
          expect(head.length, head).toBeLessThanOrEqual(KEPT);
          // and the visitor's own words never push it out of what is kept
          const withNote = composeMessage({ visit: true, date, time, layout: l.name, note: 'x'.repeat(400) });
          expect(withNote.slice(0, head.length)).toBe(head);
        }
      }
    }
  });
});

describe('the form that sends it', () => {
  const form = readFileSync(join(__dirname, 'enquiry-form.tsx'), 'utf8').replace(/\r\n/g, '\n');
  const action = readFileSync(join(__dirname, 'actions.ts'), 'utf8').replace(/\r\n/g, '\n');

  it('composes the line here, and sends a telephone number without its spaces', () => {
    expect(form).toContain('message: composeMessage({');
    expect(form).toContain("phone: (formData.get('phone') as string).replace(/[\\s()-]/g, ''),");
  });

  it('lets an enquiry name no layout: the general form sends none, and is still a lead', () => {
    // It was required, and every enquiry from /contact failed the check with
    // nothing shown: the failure belonged to no field on the form.
    expect(action).toContain('projectId: z.string().uuid().optional(),');
    expect(action).not.toMatch(/projectId: z\.string\(\)\.uuid\(\),/);
    // and a failure that belongs to no field is still said
    expect(form).toContain('if (!res.issues.name && !res.issues.phone) {');
  });

  it('keeps the trap for a bot and never pre-chooses a layout for a visitor', () => {
    expect(form).toContain('name="honeypot"');
    expect(form).toMatch(/<input type="radio" name="layout" value="" defaultChecked/);
  });

  it('sends the visit and the visitor own words as facts too, which the CRM keeps whole', () => {
    // The CRM's intake kept sixty characters of the composed line and nothing
    // else. It keeps the whole request now (@estate/domain/leads/enquiry), so
    // the form says what it knows as fields, and the action passes them on.
    for (const field of ['kind', 'visitDate', 'visitTime', 'layoutName', 'note', 'page']) {
      expect(action, field).toContain(`${field}: parsed.data.${field},`);
    }
    expect(action).toContain("kind: z.enum(['enquiry', 'site_visit']).optional(),");
    expect(form).toContain("kind: visit ? ('site_visit' as const) : ('enquiry' as const),");
    // a day that is not a date is not sent as one
    expect(form).toContain('visitDate: visit && /^\\d{4}-\\d{2}-\\d{2}$/.test(date) ? date : undefined,');
    // and the path it came from is the page's, never a query string's
    expect(form).toContain("page: typeof window !== 'undefined' ? window.location.pathname.slice(0, 120) : undefined,");
  });
});
