import { describe, expect, it } from 'vitest';
import { ENQUIRY_DETAIL_MAX, ENQUIRY_HEAD_MAX, describeEnquiry, longDay } from './enquiry';

describe('what a website enquiry said, kept whole', () => {
  it('keeps a visit request as the branch will act on it: the day, the time, the layout, the words', () => {
    const { head, detail } = describeEnquiry({
      kind: 'site_visit',
      message: 'Site visit · Sat 10 Oct · morning · Lucky Garden — We are two families, coming from Vizag.',
      note: 'We are two families, coming from Vizag.',
      preferredTime: 'morning',
      visitDate: '2026-10-10',
      visitTime: 'morning',
      layoutName: 'Lucky Garden',
      page: '/book-a-site-visit',
    });
    expect(head).toBe('Site visit · Sat 10 Oct · morning · Lucky Garden — We are tw');
    expect(head!.length).toBeLessThanOrEqual(ENQUIRY_HEAD_MAX);
    expect(detail).toBe(
      [
        'Asked to visit the site: Saturday 10 October 2026, in the morning.',
        'Layout: Lucky Garden.',
        'They wrote: We are two families, coming from Vizag.',
        'Sent from /book-a-site-visit.',
      ].join('\n'),
    );
  });

  it('keeps an ordinary enquiry: when to telephone, and every word of the message', () => {
    const long = 'Which plots facing the forty-foot road are open, and what is the rate a square yard this month? '.repeat(4).trim();
    const { head, detail } = describeEnquiry({ kind: 'enquiry', message: long, preferredTime: 'evening', page: '/contact' });
    expect(head).toBe(long.slice(0, 60));
    expect(detail).toContain('Asked to be telephoned in the evening.');
    // all of it, where sixty characters were kept before
    expect(detail).toContain(`They wrote: ${long}`);
    expect(detail).toContain('Sent from /contact.');
  });

  it('is what an older site sends, unchanged at the head: a message and nothing else', () => {
    const { head, detail } = describeEnquiry({ message: 'Please call about Kartikeya.' });
    expect(head).toBe('Please call about Kartikeya.');
    expect(detail).toBe('They wrote: Please call about Kartikeya.');
    expect(describeEnquiry({})).toEqual({ head: null, detail: null });
    expect(describeEnquiry({ message: '   ' })).toEqual({ head: null, detail: null });
  });

  it('says a visit with no day named is one, and does not invent the day', () => {
    const { head, detail } = describeEnquiry({ kind: 'site_visit', visitTime: 'any' });
    expect(detail).toBe('Asked to visit the site: no day named, at any time of day.');
    expect(head).toBe('Site visit');
    // a date that is not one is no date
    expect(describeEnquiry({ kind: 'site_visit', visitDate: '2026-02-30' }).detail).toBe('Asked to visit the site: no day named.');
    expect(longDay('2026-10-10')).toBe('Saturday 10 October 2026');
    expect(longDay('10/10/2026')).toBe('');
    expect(longDay(20261010)).toBe('');
  });

  it('trusts nothing it is sent', () => {
    const { head, detail } = describeEnquiry({
      kind: { $ne: null },
      message: 'line one\r\nline two\u0000\u0007 end',
      preferredTime: 'whenever',
      visitDate: ['2026-10-10'],
      layoutName: 12345,
      page: 'https://elsewhere.example/steal',
      note: { text: 'x' },
    });
    // not a visit, no layout, no time it does not know, no page that is not a path
    expect(detail).toBe('They wrote: line one line two end');
    expect(head).toBe('line one line two end');
    // and never longer than its columns
    const huge = describeEnquiry({ message: 'x'.repeat(50000), layoutName: 'y'.repeat(5000) });
    expect(huge.head!.length).toBe(ENQUIRY_HEAD_MAX);
    expect(huge.detail!.length).toBeLessThanOrEqual(ENQUIRY_DETAIL_MAX);
  });

  it('does not say the time to telephone twice on a visit, where the time chosen is the visit own', () => {
    const { detail } = describeEnquiry({ kind: 'site_visit', visitDate: '2026-10-11', visitTime: 'afternoon', preferredTime: 'afternoon' });
    expect(detail).toBe('Asked to visit the site: Sunday 11 October 2026, in the afternoon.');
  });
});
