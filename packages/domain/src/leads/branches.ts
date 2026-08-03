// packages/domain/src/leads/branches.ts
//
// The three Quality Homes Reality offices and the projects each owns.
//
// Every fact here is transcribed from the client's own printed collateral —
// the VSR Gayatri Township brochure carries the head office and both branch
// addresses, and each project brochure states its own location. Nothing is
// inferred, because routing a lead to the wrong office is a real commercial
// failure, not a cosmetic one.

export type BranchId = 'visakhapatnam' | 'vizianagaram' | 'srikakulam';

export interface Branch {
  id: BranchId;
  name: string;
  /** Head office vs branch, per the brochure. */
  role: 'head_office' | 'branch';
  address: string;
  pincode: string;
  /** Districts this office is the natural owner of, for the geo tiebreak. */
  territory: readonly string[];
}

export const BRANCHES: Readonly<Record<BranchId, Branch>> = {
  visakhapatnam: {
    id: 'visakhapatnam',
    name: 'Visakhapatnam',
    role: 'head_office',
    address:
      'D.No. 50-92-36, 2nd Floor, Opp. Canara Bank, Shantipuram, Shankara Matam Road, Visakhapatnam',
    pincode: '530016',
    territory: ['visakhapatnam', 'vizag', 'anakapalli'],
  },
  vizianagaram: {
    id: 'vizianagaram',
    name: 'Vizianagaram',
    role: 'branch',
    address:
      'Lakshmi Nilayam, 3rd Floor, Flat No. 401, Beside Pizza Hut, Ring Road, Vizianagaram',
    pincode: '535002',
    territory: ['vizianagaram', 'garividi', 'poosapatirega', 'bobbili'],
  },
  srikakulam: {
    id: 'srikakulam',
    name: 'Srikakulam',
    role: 'branch',
    address:
      '1st Floor, Near Simhadwaram, Above Tiles Mart, Bridge Road, Srikakulam',
    pincode: '532001',
    territory: ['srikakulam', 'etcherla', 'allinagaram', 'bayyannapeta'],
  },
} as const;

/** Hologram station ids, as built in the 3D hall. */
export type StationId = 'S1' | 'S2' | 'S3';

export interface ProjectRef {
  station: StationId;
  slug: string;
  name: string;
  locality: string;
  district: string;
  /** The office that owns this inventory. */
  branch: BranchId;
}

export const PROJECTS: readonly ProjectRef[] = [
  {
    station: 'S1',
    slug: 'kartikeya-water-front',
    name: 'Kartikeya Water Front',
    locality: 'Poosapatirega',
    district: 'Vizianagaram',
    branch: 'vizianagaram',
  },
  {
    station: 'S2',
    slug: 'lucky-garden',
    name: 'Lucky Garden',
    // The layout sheet prints this clipped at the left edge as "ARIVIDI"; the
    // brochure gives the full name. The brochure wins.
    locality: 'Kumaram Village, Garividi',
    district: 'Vizianagaram',
    branch: 'vizianagaram',
  },
  {
    station: 'S3',
    slug: 'vsr-gayatri-township',
    name: 'VSR Gayatri Township',
    locality: 'Bayyannapeta, Pedaraopalle, near Allinagaram',
    district: 'Srikakulam',
    branch: 'srikakulam',
  },
] as const;

export function projectByStation(station: StationId): ProjectRef | undefined {
  return PROJECTS.find((p) => p.station === station);
}

export function projectBySlug(slug: string): ProjectRef | undefined {
  return PROJECTS.find((p) => p.slug === slug);
}

/** Resolve a free-text city/district (from geo-IP or a form field) to the office
 *  that owns it. Deliberately conservative: an unrecognised place returns null
 *  rather than guessing, and the caller falls back to head office. */
export function branchForPlace(place: string | null | undefined): BranchId | null {
  if (!place) return null;
  const needle = place.trim().toLowerCase();
  if (!needle) return null;
  for (const b of Object.values(BRANCHES)) {
    if (b.territory.some((t) => needle.includes(t))) return b.id;
  }
  return null;
}
