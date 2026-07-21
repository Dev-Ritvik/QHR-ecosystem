// packages/domain/src/geometry/validate.test.ts

import { describe, it, expect } from 'vitest';
import { polygon } from '@turf/turf';
import type { Feature, Polygon } from 'geojson';
import { validatePolygon, MIN_AREA_SQ_METERS, OVERLAP_TOLERANCE_SQ_METERS } from './validate';

describe('Geometry Validation', () => {
  // Helpers to generate test features
  // 0.0001 degrees latitude is roughly 11.1 meters (yielding ~123 sqm for a square)
  
  const createValidSquare = (): Feature<Polygon> => 
    polygon([[[0, 0], [0.0001, 0], [0.0001, 0.0001], [0, 0.0001], [0, 0]]]);

  const createBowtie = (): Feature<Polygon> => 
    polygon([[[0, 0], [0.0001, 0.0001], [0.0001, 0], [0, 0.0001], [0, 0]]]);

  const createSliver = (): Feature<Polygon> => 
    polygon([[[0, 0], [0.000001, 0], [0.000001, 0.000001], [0, 0.000001], [0, 0]]]);

  it('allows a valid, isolated polygon', () => {
    const validSquare = createValidSquare();
    const result = validatePolygon(validSquare);
    expect(result.ok).toBe(true);
  });

  it('rejects an unclosed ring (missing closing point)', () => {
    const unclosed: Feature<Polygon> = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [[[0, 0], [0.0001, 0], [0.0001, 0.0001], [0, 0.0001]]]
      }
    };
    
    const result = validatePolygon(unclosed);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('NOT_CLOSED');
    }
  });

  it('rejects a self-intersecting polygon (bowtie)', () => {
    const bowtie = createBowtie();
    const result = validatePolygon(bowtie);
    
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('SELF_INTERSECTING');
    }
  });

  it('rejects a polygon below the minimum area threshold (sliver)', () => {
    const sliver = createSliver();
    const result = validatePolygon(sliver);
    
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('SLIVER_DETECTED');
      expect(result.message).toContain(MIN_AREA_SQ_METERS.toString());
    }
  });

  describe('Sibling overlapping', () => {
    it('allows a polygon that exactly touches a sibling (shared edge, zero overlap area)', () => {
      const validSquare = createValidSquare();
      // Touches the right edge of validSquare
      const touchingSibling = polygon([
        [[0.0001, 0], [0.0002, 0], [0.0002, 0.0001], [0.0001, 0.0001], [0.0001, 0]]
      ]);

      const result = validatePolygon(validSquare, [touchingSibling]);
      expect(result.ok).toBe(true);
    });

    it('rejects a polygon that overlaps a sibling beyond tolerance', () => {
      const validSquare = createValidSquare();
      // Overlaps the right half of validSquare
      const overlappingSibling = polygon([
        [[0.00005, 0], [0.00015, 0], [0.00015, 0.0001], [0.00005, 0.0001], [0.00005, 0]]
      ]);

      const result = validatePolygon(validSquare, [overlappingSibling]);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('OVERLAPS_SIBLING');
        expect(result.message).toContain(OVERLAP_TOLERANCE_SQ_METERS.toString());
      }
    });
  });
});
