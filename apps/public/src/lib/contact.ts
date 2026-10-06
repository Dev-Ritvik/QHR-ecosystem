// apps/public/src/lib/contact.ts
//
// THE ADDRESS THE SITE PRINTS, in one place.
//
// It is the address the offices read: qualityhomesreality@gmail.com (the
// client, 2026-10-06, asked which address to print). The audit of 2026-10-05
// had asked for one on the company's own domain, and for a day the site
// printed a mailbox that did not exist; an address nobody reads is worse than
// one on a public domain. If a company mailbox is opened later, set
// NEXT_PUBLIC_CONTACT_EMAIL and every place that prints it follows — both
// footers, the contact page and the careers page.
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'qualityhomesreality@gmail.com';

export const CONTACT_MAILTO = `mailto:${CONTACT_EMAIL}`;
