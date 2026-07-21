import * as turf from '@turf/turf';

export interface EdgeData {
  edges: { length_m: number; bearing: number }[];
  adjacent_unit_ids: string[];
}

/**
 * Computes edge lengths, bearings, and adjacencies for a set of polygons.
 * This satisfies FR-C33 (edge data derived for the skeleton view).
 */
export function computeEdgeData(
  features: { id: string; unitId: string; geom: GeoJSON.Polygon }[]
): Map<string, EdgeData> {
  const results = new Map<string, EdgeData>();

  for (const feature of features) {
    const edges: { length_m: number; bearing: number }[] = [];
    const coords = feature.geom.coordinates[0];
    
    // 1. Calculate length and bearing for every edge in the exterior ring
    for (let i = 0; i < coords.length - 1; i++) {
      const pt1 = turf.point(coords[i]);
      const pt2 = turf.point(coords[i + 1]);
      
      const length_m = Number(turf.distance(pt1, pt2, { units: 'meters' }).toFixed(2));
      const bearing = Number(turf.bearing(pt1, pt2).toFixed(2));
      
      edges.push({ length_m, bearing });
    }

    // 2. Calculate adjacencies by checking for shared vertices within a 0.5m tolerance
    const adjacent_unit_ids = new Set<string>();
    for (const other of features) {
      if (feature.id === other.id) continue;
      
      let sharedVertices = 0;
      const otherCoords = other.geom.coordinates[0];
      
      for (const c1 of coords) {
        for (const c2 of otherCoords) {
          const dist = turf.distance(turf.point(c1), turf.point(c2), { units: 'meters' });
          if (dist < 0.5) {
            sharedVertices++;
            break;
          }
        }
      }
      
      // If two polygons share at least two vertices (an edge), they are adjacent
      if (sharedVertices >= 2) {
        adjacent_unit_ids.add(other.unitId);
      }
    }

    results.set(feature.id, {
      edges,
      adjacent_unit_ids: Array.from(adjacent_unit_ids)
    });
  }

  return results;
}
