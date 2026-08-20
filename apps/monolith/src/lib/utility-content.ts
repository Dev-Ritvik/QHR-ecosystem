// apps/monolith/src/lib/utility-content.ts
//
// Content for the fifteen Command Overlay pages — MASTER_SPEC §7.
//
// ONE RULE, AND IT IS THE ONE THAT MATTERS COMMERCIALLY:
//
// Every factual claim here is either taken from a document the client supplied
// (the three project brochures) or marked `pending: true`. Nothing is invented
// to fill a page.
//
// This is not fastidiousness. Under the Consumer Protection Act 2019 a
// misleading advertisement carries up to ₹10 lakh and two years for a first
// offence, ₹50 lakh and five years on repeat — and a property page that
// overstates an approval or an amenity is exactly that. The previous build in
// this repository shipped two false claims that had to be retracted. `pending`
// renders an honest "we will confirm this" rather than a plausible guess.
//
// Content lives here rather than in the page files so that fifteen routes stay
// three lines each, and so a copy change is one edit in one place.

export interface UtilitySection {
  heading?: string;
  body: string[];
  list?: string[];
}

export interface UtilityPage {
  slug: string;
  title: string;
  lede: string;
  sections: UtilitySection[];
  /** True when this page is waiting on documents or copy from the client.
   *  Renders a visible notice; never silently fabricates. */
  pending?: boolean;
}

const BRANCHES = {
  vizag:
    'D.No. 50-92-36, 2nd & 3rd Floor, Opp. Canara Bank, Shankaramatam Road, '
    + 'Shantipuram, Visakhapatnam 530 016',
  vizianagaram:
    'Plot No. 1, 401 & 402, 3rd Floor, Lakshmi Nilayam, Ring Road, '
    + 'Srinivas Nagar, MSN Colony, Vizianagaram 535 002',
  srikakulam:
    '1st Floor, Near Simhadwaram, Above Tiles Mart, Bridge Road, '
    + 'Srikakulam 532 001',
};

export const UTILITY_PAGES: Record<string, UtilityPage> = {
  about: {
    slug: 'about',
    title: 'About',
    lede:
      'Quality Homes Reality develops and sells approved layouts across the '
      + 'northern coastal districts of Andhra Pradesh.',
    sections: [
      {
        body: [
          'We work in one corridor: Visakhapatnam, Vizianagaram and Srikakulam. '
          + 'Three branch offices, all of them in that corridor, and every layout '
          + 'we sell is inside it.',
          'That is a deliberate limit. The value of a plot is decided by what is '
          + 'being built around it — a highway, an airport, a steel plant, a '
          + 'university — and those are things you can only judge by being there.',
        ],
      },
      {
        heading: 'What we sell',
        body: [
          'Approved residential layouts, plantation farmland, and villas on '
          + 'sanctioned plots. Every project page publishes its sanction number '
          + 'in full so you can verify it independently before you speak to us.',
        ],
      },
    ],
  },

  'why-us': {
    slug: 'why-us',
    title: 'Why us',
    lede: 'Five things you can check before you trust any of them.',
    sections: [
      {
        body: [
          'Anyone can claim to be trustworthy. These are the claims we make that '
          + 'you can independently verify.',
        ],
        list: [
          'Every layout publishes its sanction number — VMRDA, RERA, SUDA, DTCP — '
          + 'in full, not as a logo.',
          'Plans are published as drawn, including plot dimensions, so what you '
          + 'see is what is registered.',
          'Rates come from the branch office that holds the site, not from a '
          + 'call centre.',
          'Three offices in the three districts we sell in.',
          'We develop and sell directly; there is no chain of intermediaries '
          + 'between you and the layout.',
        ],
      },
    ],
  },

  branches: {
    slug: 'branches',
    title: 'Branches',
    lede: 'Three offices, one corridor.',
    sections: [
      {
        heading: 'Visakhapatnam — head office',
        body: [BRANCHES.vizag],
      },
      {
        heading: 'Vizianagaram',
        body: [BRANCHES.vizianagaram],
      },
      {
        heading: 'Srikakulam',
        body: [BRANCHES.srikakulam],
      },
    ],
  },

  contact: {
    slug: 'contact',
    title: 'Contact',
    lede: 'Tell us the district and the size. The office that holds the site answers.',
    sections: [
      {
        body: [
          'Rates are quoted by the branch that owns the layout. That is slower '
          + 'than a price list and it is the only way the number you are given is '
          + 'the number that applies.',
        ],
      },
      {
        heading: 'Head office',
        body: [BRANCHES.vizag],
      },
    ],
  },

  locations: {
    slug: 'locations',
    title: 'Locations',
    lede:
      'Why the Visakhapatnam–Vizianagaram–Srikakulam corridor, and what is '
      + 'being built along it.',
    sections: [
      {
        body: [
          'Three things are changing this corridor at once: Bhogapuram '
          + 'International Airport, the six-lane national highway, and heavy '
          + 'industry moving inland.',
        ],
      },
      {
        heading: 'Garividi — Super Smelters steel plant',
        body: [
          'A 1,085-acre integrated steel plant with a stated investment of '
          + '₹8,570.50 crore and 2 million tonnes of capacity, expected to employ '
          + 'around 750 people directly, with a further 97.04 acres and 53.35 '
          + 'acres allotted for railway siding.',
          'These figures are as published in the Lucky Garden project material. '
          + 'Verify current status with the district authority before treating '
          + 'them as a basis for investment.',
        ],
      },
    ],
  },

  'investment-guide': {
    slug: 'investment-guide',
    title: 'Investment guide',
    lede: 'How plotted land, farmland and villas differ as investments.',
    pending: true,
    sections: [
      {
        body: [
          'This guide will cover approval types and what each one permits, the '
          + 'registration process and its costs, financing and bank loan '
          + 'eligibility on plotted land, and the difference in holding period '
          + 'between residential plots and plantation farmland.',
        ],
      },
    ],
  },

  knowledge: {
    slug: 'knowledge',
    title: 'Knowledge',
    lede: 'Market notes, buying guidance and company updates.',
    pending: true,
    sections: [{ body: ['Articles are being prepared.'] }],
  },

  downloads: {
    slug: 'downloads',
    title: 'Downloads',
    lede: 'Brochures, master plans and sanctioned layout drawings.',
    pending: true,
    sections: [
      {
        body: [
          'Each project brochure and its sanctioned layout drawing will be '
          + 'published here as a PDF, with the file size stated so you know what '
          + 'you are downloading on mobile data.',
        ],
      },
    ],
  },

  gallery: {
    slug: 'gallery',
    title: 'Gallery',
    lede: 'Site photography, drone footage and event coverage.',
    pending: true,
    sections: [{ body: ['Photography is being collected from the three sites.'] }],
  },

  testimonials: {
    slug: 'testimonials',
    title: 'Testimonials',
    lede: 'Customer accounts, published with consent.',
    pending: true,
    sections: [
      {
        body: [
          'Testimonials will be published with the customer’s name and consent, '
          + 'or not at all. Unattributed praise is not evidence of anything.',
        ],
      },
    ],
  },

  updates: {
    slug: 'updates',
    title: 'Construction updates',
    lede: 'Progress and milestones on open projects.',
    pending: true,
    sections: [{ body: ['Update schedule to be confirmed with the site teams.'] }],
  },

  careers: {
    slug: 'careers',
    title: 'Careers',
    lede: 'Openings across the three branches.',
    pending: true,
    sections: [{ body: ['Current openings will be listed here.'] }],
  },

  'site-visit': {
    slug: 'site-visit',
    title: 'Book a site visit',
    lede: 'See the layout before you decide anything.',
    sections: [
      {
        body: [
          'A site visit is the only way to judge a plot — the approach road, the '
          + 'drainage fall, what is being built next door. We will arrange one at '
          + 'whichever project you name.',
          'Call the branch that holds the site, or ask through the contact page '
          + 'and we will call you back.',
        ],
      },
    ],
  },

  faqs: {
    slug: 'faqs',
    title: 'Questions',
    lede: 'What buyers ask most often.',
    sections: [
      {
        heading: 'Why are prices not on the website?',
        body: [
          'Because the rate depends on the plot, and the branch holding the site '
          + 'knows which plots are actually available today. A published price '
          + 'list goes stale the day a plot sells.',
        ],
      },
      {
        heading: 'What does the approval number mean?',
        body: [
          'It identifies the sanction granted to that specific layout by the '
          + 'named authority. You can verify it with that authority directly, and '
          + 'we publish it in full so that you can.',
        ],
      },
      {
        heading: 'Can I get a bank loan on a plot?',
        body: [
          'On approved residential layouts, generally yes. Eligibility depends '
          + 'on the bank, the approval type and your own profile — confirm with '
          + 'the branch before you plan around it.',
        ],
      },
    ],
  },

  privacy: {
    slug: 'privacy',
    title: 'Privacy',
    lede: 'What we collect, why, and how to withdraw it.',
    pending: true,
    sections: [
      {
        body: [
          'This policy must be reviewed by counsel before launch. It has to '
          + 'satisfy the DPDP Act 2023, and — because the site serves visitors in '
          + 'Germany and the United States — the GDPR and applicable US state '
          + 'privacy laws.',
          'Consent categories are already enforced in the product: nothing '
          + 'beyond essential cookies loads until you choose, and your choice is '
          + 'recorded with the policy version it was given against.',
        ],
      },
    ],
  },

  terms: {
    slug: 'terms',
    title: 'Terms',
    lede: 'The terms governing use of this site.',
    pending: true,
    sections: [{ body: ['Awaiting review by counsel.'] }],
  },

  'cookie-policy': {
    slug: 'cookie-policy',
    title: 'Cookies',
    lede: 'Every cookie this site sets, and what it does.',
    pending: true,
    sections: [
      {
        body: [
          'A complete cookie table will be published here once the analytics and '
          + 'marketing vendors are fixed. Until then no non-essential cookie is '
          + 'set at all, which is why the table is short rather than absent.',
        ],
      },
    ],
  },

  'refund-policy': {
    slug: 'refund-policy',
    title: 'Refunds',
    lede: 'Booking, cancellation and refund terms.',
    pending: true,
    sections: [{ body: ['Awaiting confirmation of the current booking terms.'] }],
  },
};

export const UTILITY_SLUGS = Object.keys(UTILITY_PAGES);
