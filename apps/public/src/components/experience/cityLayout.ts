// apps/public/src/components/experience/cityLayout.ts
//
// PUBLISHED PROJECT DATA -> CITY REPRESENTATION -> BEACON MODEL.
//
// ─────────────────────────────────────────────────────────────────────────────
// THERE ARE NO COORDINATES. THIS IS THE WHOLE REASON THIS FILE EXISTS.
// ─────────────────────────────────────────────────────────────────────────────
//
// projection.projects_pub carries a `centroid` (a PostGIS point) and a `bbox`,
// and the site's map component reads them. Queried live against the projection
// this build talks to:
//
//     slug                    city           locality                          centroid  bbox
//     kartikeya-water-front   Vizianagaram   Poosapatirega                     NULL      NULL
//     lucky-garden            Vizianagaram   Kumaram Village, Garividi         NULL      NULL
//     vsr-gayatri-township    Srikakulam     Bayyannapeta, near Allinagaram    NULL      NULL
//
//     projection.geometry_pub   0 rows
//     projection.pois_pub       0 rows
//
// Not one published project has a location. So there is nothing to project, no
// datum to choose and no scale bar to draw, and any "map" of these three would
// be three dots invented by whoever wrote the code. The brief is explicit about
// that: do not fabricate coordinates, and do not pretend to a precision the
// repository does not have.
//
// WHAT IS REAL, AND WHAT IT IS USED FOR
//
//     city (district)   Vizianagaram x2, Srikakulam x1   which BAND a beacon
//                                                        sits in
//     publication order the projection's own ordering     which band comes
//                                                        first, left to right
//     slug              stable, unique, sanctioned        the deterministic
//                                                        seed for the position
//                                                        inside a band
//     totalUnits        113 / 181 / 113                   beacon WEIGHT — a
//                                                        larger layout reads
//                                                        larger
//     availableUnits    113 / 118 / 113                   beacon state
//     locality          real place names                  the label
//
// So the field is a DIAGRAM OF THE NETWORK, not a map of Andhra Pradesh: the
// districts are bands in publication order, and a project's place inside its
// band is a hash of its own slug. It is stable across reloads and machines, it
// is derived entirely from sanctioned data, and it claims nothing about where
// any of this land actually is. If centroids are ever published, `fromCentroids`
// below is where a real projection goes, and this becomes the fallback.

/** The published fields the layout is allowed to see. */
export interface CityProject {
  slug: string;
  name: string;
  /** projects_pub.locality — a real place name, used as the label's second line. */
  locality: string;
  /** projects_pub.city — the district. Two of the three share one. */
  city: string;
  totalUnits: number;
  availableUnits: number;
  soldOut: boolean;
}

export interface Beacon {
  slug: string;
  name: string;
  locality: string;
  district: string;
  /** Field coordinates, in the same metres the hall model uses. */
  x: number;
  z: number;
  /** 0..1 by total units against the largest in the set. Drives size only. */
  weight: number;
  totalUnits: number;
  availableUnits: number;
  soldOut: boolean;
  /** The real route. Verified to exist: app/(site)/projects/[projectSlug]. */
  href: string;
}

/**
 * The field, in hall metres, measured against the geometry it is seen through.
 *
 * The hall's front wall stands at z 7.7 with `int_door_arch` at z 7.63 spanning
 * roughly 4.1m of width and 4.4m of height, the extended hall's doorway. The
 * camera reads the field through
 * that opening from inside, so the field starts far enough beyond the threshold
 * that the doorway crops it — which is what makes the opening read as a frame
 * rather than as a hole cut in a backdrop.
 */
export const FIELD = {
  /**
   * Nearest and furthest z of the populated band, and the half-width — all
   * three set by what the DOORWAY can actually frame rather than by taste.
   *
   * The opening is 2.99m wide and the camera stands 1.95m back from it, so the
   * view through it is a cone of +/-37.5 degrees — the same cone as before the
   * hall was extended, because the standoff grew with the doorway. The band is
   * carried out with that doorway, which moved 2.4m toward the field: 26..58 and
   * +/-15 keeps every marker inside the frame at every depth, with the band
   * margins below leaving 9.5m of usable width per district.
   */
  near: 26,
  far: 58,
  halfWidth: 15,
  /**
   * Where the populated band is CENTRED, and why it is not on the axis.
   *
   * The chapter's copy runs down the left of the page over the canvas, and it
   * is real interactive text — so a marker projected behind it is on screen and
   * not clickable: a click there lands on the list. Measured at 1440x900, the
   * leftmost of the three markers landed at x 620 with the copy column reaching
   * x 720, and `document.elementFromPoint` at that marker returned the list
   * rather than the canvas.
   *
   * The camera looks toward +z, so screen-right is world -x. Shifting the field
   * 3.5m in that direction moves every marker about 85px right, and the column
   * is narrowed to match the other chapters' measure, which takes it to x 628.
   */
  centreX: -3.5,
  /** Ground height. Below the hall floor, so the land falls away from the
   *  threshold instead of continuing it. */
  y: -2.4,
} as const;

/** 32-bit FNV-1a. Deterministic, dependency-free, and stable across engines —
 *  which `Math.random()` and `String.hashCode`-style sums are not. */
function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Two independent 0..1 draws from one slug, so x and z do not correlate. */
function seeded(slug: string): [number, number] {
  const a = hash32(slug);
  const b = hash32(`${slug}:z`);
  return [a / 0xffffffff, b / 0xffffffff];
}

/**
 * Districts, in publication order, each with the horizontal band it owns.
 *
 * Ordered by where their FIRST project appears in the input, which is the
 * projection's own `published_at` ordering. Deliberately not alphabetical and
 * deliberately not geographic: alphabetical would be arbitrary, and geographic
 * would be the fabrication this file exists to avoid.
 */
export function districtBands(projects: CityProject[]): { district: string; from: number; to: number }[] {
  const order: string[] = [];
  for (const p of projects) {
    const d = p.city || 'Unlisted';
    if (!order.includes(d)) order.push(d);
  }
  const span = (FIELD.halfWidth * 2) / Math.max(1, order.length);
  const left = FIELD.centreX - FIELD.halfWidth;
  return order.map((district, i) => ({
    district,
    from: left + i * span,
    to: left + (i + 1) * span,
  }));
}

/**
 * Beacons for the published set.
 *
 * Placement inside a band leaves a margin at each edge so two adjacent
 * districts never touch, and then RELAXES: any pair closer than MIN_GAP is
 * pushed apart along the line between them, four fixed passes, clamped back
 * into the band each time. Fixed passes rather than "until settled" keeps the
 * result deterministic — a convergence loop would depend on floating-point
 * ordering, which is exactly the kind of thing that reshuffles a layout between
 * one machine and another.
 */
export function buildBeacons(projects: CityProject[]): Beacon[] {
  if (!projects.length) return [];

  const bands = districtBands(projects);
  const maxUnits = Math.max(1, ...projects.map((p) => p.totalUnits || 0));
  const MARGIN = 5.5;
  const MIN_GAP = 11;

  const out: Beacon[] = projects.map((p) => {
    const band = bands.find((b) => b.district === (p.city || 'Unlisted')) ?? bands[0];
    const [u, v] = seeded(p.slug);
    const lo = band.from + MARGIN;
    const hi = band.to - MARGIN;
    return {
      slug: p.slug,
      name: p.name,
      locality: p.locality,
      district: p.city || 'Unlisted',
      x: lo + u * Math.max(0, hi - lo),
      z: FIELD.near + v * (FIELD.far - FIELD.near),
      weight: Math.min(1, (p.totalUnits || 0) / maxUnits),
      totalUnits: p.totalUnits,
      availableUnits: p.availableUnits,
      soldOut: p.soldOut,
      href: `/projects/${p.slug}`,
    };
  });

  for (let pass = 0; pass < 4; pass += 1) {
    for (let i = 0; i < out.length; i += 1) {
      for (let j = i + 1; j < out.length; j += 1) {
        const a = out[i];
        const b = out[j];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        if (d >= MIN_GAP || d < 1e-6) continue;
        const push = (MIN_GAP - d) / 2;
        const nx = dx / d;
        const nz = dz / d;
        a.x -= nx * push;
        a.z -= nz * push;
        b.x += nx * push;
        b.z += nz * push;
      }
    }
    for (const beacon of out) {
      const band = bands.find((bd) => bd.district === beacon.district) ?? bands[0];
      beacon.x = Math.min(band.to - MARGIN * 0.5, Math.max(band.from + MARGIN * 0.5, beacon.x));
      beacon.z = Math.min(FIELD.far, Math.max(FIELD.near, beacon.z));
    }
  }

  return out;
}

/**
 * The real projection, for the day the data supports one.
 *
 * Left as a named seam rather than written speculatively: an equirectangular
 * projection about the set's own centroid is the right choice for three sites
 * inside two adjacent districts, but writing it now would mean testing it
 * against coordinates that do not exist. When `projects_pub.centroid` is
 * populated, this is where it goes, and buildBeacons becomes the fallback for
 * projects that still have none.
 */
export function fromCentroids(): null {
  return null;
}
