import { describe, it, expect } from 'vitest';
import { computeEdgeData } from './edge-derivation';

describe('computeEdgeData', () => {
  it('calculates edge lengths, bearings, and adjacencies correctly', () => {
    // 0.001 degree is approx 111 meters
    const poly1: GeoJSON.Polygon = {
      type: 'Polygon',
      coordinates: [[[0, 0], [0, 0.001], [0.001, 0.001], [0.001, 0], [0, 0]]]
    };
    
    const poly2: GeoJSON.Polygon = {
      type: 'Polygon',
      coordinates: [[[0.001, 0], [0.001, 0.001], [0.002, 0.001], [0.002, 0], [0.001, 0]]]
    };
    
    const features = [
      { id: 'f1', unitId: 'u1', geom: poly1 },
      { id: 'f2', unitId: 'u2', geom: poly2 }
    ];

    const result = computeEdgeData(features);
    
    expect(result.size).toBe(2);
    
    const data1 = result.get('f1')!;
    const data2 = result.get('f2')!;
    
    // Check adjacencies (they share the vertical edge at longitude 0.001)
    expect(data1.adjacent_unit_ids).toContain('u2');
    expect(data2.adjacent_unit_ids).toContain('u1');
    
    // Check edge computations
    expect(data1.edges.length).toBe(4);
    
    // The first edge (0,0 -> 0,0.001) is due North (bearing ~0)
    expect(Math.abs(data1.edges[0].bearing)).toBeLessThan(1);
    
    // Edge lengths should be approximately 111m
    expect(data1.edges[0].length_m).toBeGreaterThan(110);
    expect(data1.edges[0].length_m).toBeLessThan(112);
  });
});
