// apps/public/src/lib/layouts.ts
//
// THE THREE LAYOUTS, AS THEIR OWN PAPER DESCRIBES THEM. ONCE.
//
// What a layout IS does not change from page to page, and it was written out
// on six of them — the plot sizes on four, the road widths on five, the
// approval on five — each from the same sheets and each a little differently.
// The Kartikeya roads were "40 and 30 feet" on two pages and "40 and 33" on two
// others. Both are on the sheet: its internal roads are 40 and 30 feet wide,
// and the road it is reached by is 33. One record, so the pages agree.
//
// THE SOURCING RULE IS THE PAGES', AND IT STANDS. Every fact below is printed
// on that layout's sanctioned plan or its brochure:
//
//   sizes, roads     the dimension labels and road labels on the plan sheet
//   approval         the approval block of the sheet, or the brochure's panel
//   features         the brochure's own list (Kartikeya's; the other two
//                    brochures list none, so none are claimed)
//   access, near     the access map and "nearby" panel of the brochure
//
// No distance, travel time, price, yield or date has been estimated. Where a
// sheet states a figure it is quoted; where it does not, nothing is said.
// Areas are arithmetic on the printed dimensions (nine square feet to the
// square yard), not a claim of their own.
//
// AND NO COMPASS POINT THE SHEET DOES NOT GIVE. Kartikeya's sheet carries a
// north point, so its sides are named. The other two, as published, carry
// none — Gayatri's is printed turned a quarter (its plot numbers read down the
// page) — and two pages said "to the west" and "the western boundary" of them
// by reading the top of the image as north. Those say "beside" and "along one
// side" now. Nor a KEY the sheet does not print: Lucky Garden's plots are
// marked in four colours and Gayatri's sheet hatches two blocks, and neither
// sheet as published says what the marks mean; the pages said "plot status is
// marked on the sheet", which a reader cannot use. They say what is there and
// send the question to the branch. (Re-read off the PDFs on 2026-10-06:
// _capture_tools/replay/c12/pdf_sheet.py.)
//
// WHAT IS NOT HERE: how many plots a layout has and how many are open. Those
// are read live from the projection (the same register the film and the CRM
// read), never typed into a page.
//
// Pure data. The one thing imported is how a plot's size is written
// (units.plotSize: one unbroken size, as the sheets mark it).

import { plotSize } from './units';

export interface PlotSize {
  /** As the sheet prints it. */
  label: string;
  /** Feet, frontage by depth as printed. */
  feet: [number, number];
}

export interface LayoutRecord {
  slug: string;
  name: string;
  /** The village or locality. */
  where: string;
  district: 'Vizianagaram' | 'Srikakulam';
  /** One sentence, from the sheet. */
  summary: string;
  sizes: PlotSize[];
  /** The roads inside the layout, as the sheet labels them. */
  roads: string;
  /** Their widths in feet, widest first, as printed. */
  roadWidths: number[];
  /** The road it is reached by, where the sheet shows one. */
  approach?: string;
  /**
   * The approving authority, and its reference where the paper in hand prints
   * one. `short` is a few words for a list; `line` the whole of what can be
   * said. Lucky Garden's sheet, as published, carries no approval block and
   * its brochure no number: the page says whose layout plan it is and sends
   * the reader to the branch for the reference, which is what the guide tells
   * a buyer to ask for anywhere. (The pages said "see the approval block on
   * the plan": there is none on the plan they offered.)
   */
  approval: { authority: string; reference: string | null; short: string; line: string };
  /** What the brochure says is provided. Empty where it lists nothing. */
  features: string[];
  /** What else the sheet shows that a buyer would want pointed out. */
  onTheSheet: string[];
  access: string[];
  near: { label: string; items: string[] }[];
  plan: { src: string; w: number; h: number; pdf: string; pdfSize: string };
  /** The office that holds it. */
  branch: 'vizianagaram' | 'srikakulam';
}

export const LAYOUTS: readonly LayoutRecord[] = [
  {
    slug: 'kartikeya-water-front',
    name: 'Kartikeya Water Front',
    where: 'Poosapatirega',
    district: 'Vizianagaram',
    summary:
      'Plots of three depths on a grid of blacktop roads, with a lake beside the road in and its pool, play area and court drawn into the plan.',
    sizes: [
      { label: plotSize(30, 50), feet: [30, 50] },
      { label: plotSize(30, 56), feet: [30, 56] },
      { label: plotSize(30, 60), feet: [30, 60] },
    ],
    roads: '40 ft and 30 ft internal roads, blacktop, with street lighting',
    roadWidths: [40, 30],
    approach: 'Entered at its north-east corner, from a 33 ft road',
    approval: {
      authority: 'VMRDA',
      reference: null,
      short: 'VMRDA layout',
      line: 'A VMRDA RERA layout',
    },
    features: [
      'A grand entrance arch',
      'Children’s playground',
      'Jogging and walking tracks',
      'Cricket practice nets',
      'A basketball court',
      'A swimming pool',
      'A future commercial zone and utility spaces',
      'Underground drainage and water connections',
      'Gated, with CCTV round the clock',
    ],
    onTheSheet: [
      'Two 40 ft roads, one along the northern side and one down the middle, crossed by three 30 ft roads',
      'The lake to the east, beside the 33 ft road in',
      'The swimming pool at the north-west corner and the play area down the western side',
      'Plots on the northern boundary follow its line, so each has its own depth, printed on it',
      'A utility strip at the southern edge',
    ],
    access: [
      'Off AH-16, with the layout entrance on the Poosapatirega side',
      'Roads signposted to Vizianagaram, Visakhapatnam and Srikakulam',
      'Agraharam is the neighbouring settlement on the highway approach',
    ],
    near: [{ label: 'Landmarks', items: ['Ramatheertham', 'Heritage Kumili Temple', 'Vizianagaram Fort'] }],
    plan: {
      src: '/gallery/kartikeya-layout.jpg',
      w: 1600,
      h: 1557,
      pdf: '/downloads/kartikeya-water-front-layout.pdf',
      pdfSize: '118 KB',
    },
    branch: 'vizianagaram',
  },
  {
    slug: 'lucky-garden',
    name: 'Lucky Garden',
    where: 'Kumaram Village, Garividi',
    district: 'Vizianagaram',
    summary:
      'Long, narrow plots in rows off 20 ft roads, with the land beside them held back for a future extension.',
    sizes: [
      { label: plotSize(15, 60), feet: [15, 60] },
      { label: plotSize(18, 60), feet: [18, 60] },
    ],
    roads: '20 ft internal roads, marked on the sheet as proposed',
    roadWidths: [20],
    approval: {
      authority: 'Panchayat',
      reference: null,
      short: 'Panchayat layout',
      line: 'A Panchayat layout plan. Ask the branch for its approval reference',
    },
    features: [],
    onTheSheet: [
      'The future extension, drawn beside the plotted rows and left unplotted',
      `A schedule of plot areas in sq yd: the regular ${plotSize(15, 60)} plots at 100, each odd-shaped plot with its own figure`,
      'Some plots drawn joined in pairs or split in two, and numbered so',
      'Plots marked in four colours. The sheet as published prints no key to them: the branch will say what each records',
    ],
    access: [
      'Reached from the Garividi side of Kumaram Village',
      'Internal roads laid out at 20 ft, as marked on the layout plan',
    ],
    near: [],
    plan: {
      src: '/gallery/lucky-garden-layout.jpg',
      w: 1600,
      h: 948,
      pdf: '/downloads/lucky-garden-layout.pdf',
      pdfSize: '288 KB',
    },
    branch: 'vizianagaram',
  },
  {
    slug: 'vsr-gayatri-township',
    name: 'VSR Gayatri Township',
    where: 'Bayyannapeta, Pedaraopalle, near Allinagaram',
    district: 'Srikakulam',
    summary:
      'One plot size throughout, every plot on a 40 ft road, with the public open space set along one side.',
    sizes: [{ label: plotSize(60, 30), feet: [60, 30] }],
    roads: '40 ft internal roads throughout',
    roadWidths: [40],
    approval: {
      authority: 'SUDA',
      reference: 'F.L.P. No. 10/2025/1178/DTCP/DPMS',
      short: 'SUDA approved',
      line: 'SUDA approved, under F.L.P. No. 10/2025/1178/DTCP/DPMS',
    },
    features: [],
    onTheSheet: [
      'A public open space along one side, with its area printed on it',
      'Two utility areas and three amenity plots, each labelled',
      'The village road to Bayyannapeta, along the side away from the open space',
      'Agricultural land adjoining, marked with its survey number',
      'Two blocks of plots hatched. The sheet as published prints no key to the hatching: the branch will say what it records',
    ],
    access: [
      'Two kilometres from the National Highway',
      'On the Allinagaram road, off the Chilakapalem junction approach',
      'Internal roads laid out at 40 ft, as marked on the layout plan',
    ],
    near: [
      {
        label: 'Education',
        items: [
          'Sri Sivani Engineering College',
          'Sri Sivani Polytechnic College',
          'Ambedkar University',
          'Sri Venkateswara College of Engineering and Technology',
          // (its last two words held together: "School" stood alone on a phone's line)
          'Kesava Reddy Residential and Non-Residential School',
          'RGVKT IIIT campus',
          'Sri Kinjarapu Errannaidu Agricultural College',
          'N.E.R Schools',
          'A.P. Residential Model School, S.M. Puram',
          'Government ITI College',
        ],
      },
      { label: 'Civic', items: ['Police Training Academy', 'R.T.O. Office'] },
    ],
    plan: {
      src: '/gallery/gayatri-layout.jpg',
      w: 1600,
      h: 1140,
      pdf: '/downloads/vsr-gayatri-township-layout.pdf',
      pdfSize: '630 KB',
    },
    branch: 'srikakulam',
  },
] as const;

export function layoutBySlug(slug: string): LayoutRecord | undefined {
  return LAYOUTS.find((l) => l.slug === slug);
}

/** A plot's area from its printed dimensions: square feet and square yards. */
export function plotArea(size: PlotSize): { sqFt: number; sqYd: number } {
  const sqFt = size.feet[0] * size.feet[1];
  return { sqFt, sqYd: Math.round((sqFt / 9) * 100) / 100 };
}

/** "1,500 sq ft · 166.67 sq yd" */
export function plotAreaLabel(size: PlotSize): string {
  const a = plotArea(size);
  const yd = Number.isInteger(a.sqYd) ? String(a.sqYd) : a.sqYd.toFixed(2);
  return `${a.sqFt.toLocaleString('en-IN')} sq ft · ${yd} sq yd`;
}
