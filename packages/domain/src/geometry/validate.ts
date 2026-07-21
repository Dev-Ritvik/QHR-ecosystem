// packages/domain/src/geometry/validate.ts

import { area, kinks, intersect, featureCollection } from '@turf/turf';
import type { Feature, Polygon } from 'geojson';

export const MIN_AREA_SQ_METERS = 1.0; // Polygons under 1 sqm are considered accidental slivers
export const OVERLAP_TOLERANCE_SQ_METERS = 0.1; // Tolerance for shared-edge snapping slop

export type GeometryValidationResult =
  | { ok: true }
  | { 
      ok: false; 
      code: 'NOT_CLOSED' | 'SELF_INTERSECTING' | 'SLIVER_DETECTED' | 'OVERLAPS_SIBLING'; 
      message: string 
    };

/**
 * Validates a traced plot polygon (FR-C31, NFR-D7).
 * Ensures it is a closed ring, non-self-intersecting, meets a minimum area,
 * and does not overlap with provided sibling polygons beyond a snapping tolerance.
 */
export function validatePolygon(
  poly: Feature<Polygon>,
  siblings: Feature<Polygon>[] = []
): GeometryValidationResult {
  // 1. Closed ring check
  const coords = poly.geometry?.coordinates;
  if (!coords || coords.length === 0) {
    return { ok: false, code: 'NOT_CLOSED', message: 'Polygon has no coordinates.' };
  }
  
  for (const ring of coords) {
    if (ring.length < 4) {
      return { ok: false, code: 'NOT_CLOSED', message: 'A linear ring must have at least 4 positions.' };
    }
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      return { ok: false, code: 'NOT_CLOSED', message: 'First and last coordinates of a ring must match exactly.' };
    }
  }

  // 2. Self-intersecting check (kinks)
  const selfIntersections = kinks(poly);
  if (selfIntersections.features.length > 0) {
    return { 
      ok: false, 
      code: 'SELF_INTERSECTING', 
      message: 'Polygon edges cannot cross each other (self-intersect).' 
    };
  }

  // 3. Min-area sliver check
  const polyArea = area(poly);
  if (polyArea < MIN_AREA_SQ_METERS) {
    return { 
      ok: false, 
      code: 'SLIVER_DETECTED', 
      message: `Polygon area is too small (${polyArea.toFixed(2)} sqm). Minimum is ${MIN_AREA_SQ_METERS} sqm.` 
    };
  }

  // 4. Sibling overlap check
  for (let i = 0; i < siblings.length; i++) {
    const sibling = siblings[i];
    
    // intersect returns a Feature (Polygon or MultiPolygon) or null if no intersection
    const overlap = intersect(featureCollection([poly, sibling]));
    
    if (overlap) {
      const overlapArea = area(overlap);
      if (overlapArea > OVERLAP_TOLERANCE_SQ_METERS) {
        return { 
          ok: false, 
          code: 'OVERLAPS_SIBLING', 
          message: `Polygon overlaps a sibling boundary by ${overlapArea.toFixed(2)} sqm (tolerance: ${OVERLAP_TOLERANCE_SQ_METERS} sqm).` 
        };
      }
    }
  }

  return { ok: true };
}
