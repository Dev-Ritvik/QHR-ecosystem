// apps/public/src/lib/company.ts
//
// WHAT THE COMPANY SAYS ABOUT ITSELF, ONCE.
//
// Every fact here was on a page already, each page with its own copy of it —
// the telephone number in four files, the four figures in one, the founder's
// name in the hall's nameplate and nowhere a page could read it. One module,
// so two pages cannot come to disagree about a number, and so a correction is
// one line.
//
// THE SOURCING RULE IS THE ABOUT PAGE'S, AND IT STANDS: the four figures, the
// vision, the mission and the values are corroborated on both of the client's
// own sites (qualityhomesreality.com, the site that has been trading, and
// qualityhomesreality.in); where the two disagreed, nothing was published. The
// certificates, memberships, awards and press names that one of them shows
// under "Verified credentials" are not here and are not to be added until the
// papers are in hand: each is a third party's claim with a public register
// behind it, and a wrong one is a misleading advertisement. The founder's name
// was supplied by the client on 2026-09-18 for the nameplate in the hall
// (PortraitNameplate.tsx; a test holds the two together).
//
// Pure data. Nothing is imported.

export const COMPANY = {
  name: 'Quality Homes Reality',
  phone: { display: '+91 95535 13366', href: 'tel:+919553513366' },
  founder: { name: 'K. Bhaskara Rao', title: 'Managing Director' },
  /** The four figures both of the company's own sites carry, identically. */
  figures: [
    { value: '20', unit: 'years', label: 'in the field' },
    { value: '5,000', unit: '', label: 'customers' },
    { value: '12', unit: 'lakh sq yd', label: 'developed' },
    { value: '8', unit: 'lakh sq yd', label: 'in development' },
  ],
  motto: {
    te: 'భూమిలో పెట్టుబడి పెట్టండి, అది ఎప్పుడూ నిరాశపరచదు.',
    en: 'Invest in land — it will never disappoint you.',
  },
  /** In the company's own words, as both of its sites print them. */
  vision:
    'To be acknowledged as India’s leading and most trusted real estate enterprise by nurturing a transparent, trustworthy and professional work culture that endears us to discerning customers, and by continuously expanding our offerings to reach a wider market.',
  mission:
    'To be the provider of choice for global-standard residential properties by delivering projects enriched with innovative design, exceptional location, harmonious environs, superior quality, world-class amenities, best-in-class security and unmatched value.',
  values: ['Quality', 'On-time possession', 'Integrity', 'Reliability', 'Transparency'],
} as const;
