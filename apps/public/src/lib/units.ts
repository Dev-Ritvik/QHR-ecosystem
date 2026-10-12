// apps/public/src/lib/units.ts
//
// HOW A MEASUREMENT IS WRITTEN ON THIS SITE, ONCE.
//
// The forensic audit of 2026-10-09 (#90) counted the ways the pages wrote the
// same things: a road's width as "40-foot", "40 feet", "40ft", "40′",
// "forty-foot" and "30 by 60"; a plot as "30′ × 50′" and "30′×50′"; an area as
// "sq yd", "square yards" and "Square yards"; a PIN as "– 530016" and
// "530 016"; one layout's cameras as "24×7 CCTV" and "CCTV round the clock".
// "A site whose claim is exactness should write a foot the same way twice."
//
// THE STYLE, and a test holds every page and the layouts' own data to it
// (units.test.ts):
//
//   a plot's two sides   30′ × 50′     a prime after each figure, a
//                                      multiplication sign with a space each
//                                      side: as the sheets mark a plot.
//   a length             40 ft         a figure, a space, "ft": a road's
//                                      width, in a sentence or a table. Not
//                                      "40-foot", not "40 feet", not "40′"
//                                      (the prime is a plot's).
//   an area              167 sq yd     a figure, a space, "sq yd" ("sq ft"
//                                      likewise) — and "sq yd" where no
//                                      figure stands with it too ("a rate
//                                      per sq yd"): the unit is written one
//                                      way, not one way with a number and
//                                      another without.
//   a PIN                Visakhapatnam 530016
//                                      six figures unbroken, after its town
//                                      with a space that does not break, and
//                                      no dash: an address must never end on
//                                      a line that is a dash and a number
//                                      (the audit's #59).
//   a layout's cameras   CCTV round the clock
//
// Pure functions and nothing else: a page's script may read them.

/** A length in feet: a road's width. */
export function ft(n: number): string {
  return `${n} ft`;
}

/** A plot by its two sides, as its sheet marks it. */
export function plotSize(a: number, b: number): string {
  return `${a}′ × ${b}′`;
}

/** An address with its PIN: the PIN kept on the line its town is on. */
export function withPin(address: string, pincode: string): string {
  return `${address} ${pincode}`;
}
