// apps/public/src/components/map/skeleton-view.ts
import type { LayerSpecification } from 'maplibre-gl';

export function getFacingArrow(facing: string): string {
  if (!facing) return '';
  const f = facing.toLowerCase().replace(/_/g, '');
  switch (f) {
    case 'north': return '↑ N';
    case 'south': return '↓ S';
    case 'east': return '→ E';
    case 'west': return '← W';
    case 'northeast': return '↗ NE';
    case 'northwest': return '↖ NW';
    case 'southeast': return '↘ SE';
    case 'southwest': return '↙ SW';
    default: return '';
  }
}

/**
 * Transforms the standard geometry_pub into a dedicated GeoJSON source 
 * for the FR-PM6a dimensioned technical view.
 */
export function buildSkeletonGeoJSON(geometry: any[], units: any[]): any {
  const features: any[] = [];
  const unitMap = new Map(units.map(u => [u.unitId, u]));

  geometry.forEach(g => {
    const props = g.properties || {};

    if (g.featureType === 'plot' && g.unitId) {
      const unit = unitMap.get(g.unitId);
      if (!unit) return;

      // 1. Plot Label Point (Center) - MapLibre places polygon point labels at the visual center.
      features.push({
        type: 'Feature',
        geometry: g.geom,
        properties: {
          type: 'plot_label',
          plotNumber: unit.unitNumber,
          facingArrow: getFacingArrow(unit.facing),
        }
      });

      // 2. Edges - break the polygon into LineStrings to render dimensions along each boundary
      if (g.geom.type === 'Polygon' && Array.isArray(props.edges)) {
        const ring = g.geom.coordinates[0];
        props.edges.forEach((edge: any, i: number) => {
          if (ring[i] && ring[i + 1]) {
            const isAdjacent = Array.isArray(edge.adjacent) && edge.adjacent.length > 0;
            let text = `${Math.round(edge.len_m * 10) / 10}m`;
            
            // FR-C33: Adjacent plot numbers
            if (isAdjacent) {
               const adjIds = edge.adjacent as string[];
               const adjNumbers = adjIds.map(id => unitMap.get(id)?.unitNumber).filter(Boolean);
               if (adjNumbers.length > 0) {
                 text += ` | Adj: ${adjNumbers.join(', ')}`;
               }
            }

            features.push({
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: [ring[i], ring[i + 1]]
              },
              properties: {
                type: 'edge_dimension',
                lengthText: text,
              }
            });
          }
        });
      }
    } else if (g.featureType === 'road') {
      // 3. Road widths
      features.push({
        type: 'Feature',
        geometry: g.geom,
        properties: {
          type: 'road_label',
          widthText: props.width_m ? `${props.width_m}m ROW` : '',
        }
      });
    }
  });

  return { type: 'FeatureCollection', features };
}

export const SKELETON_LAYERS: LayerSpecification[] = [
  {
    id: 'skeleton-edges',
    type: 'line',
    source: 'skeleton-source',
    filter: ['==', 'type', 'edge_dimension'],
    paint: {
      'line-color': '#94a3b8', // slate-400
      'line-width': 2,
      'line-dasharray': [2, 2]
    }
  },
  {
    id: 'skeleton-edge-labels',
    type: 'symbol',
    source: 'skeleton-source',
    filter: ['==', 'type', 'edge_dimension'],
    layout: {
      'symbol-placement': 'line',
      'text-field': ['get', 'lengthText'],
      'text-size': 13,
      'text-offset': [0, -0.5],
      'text-anchor': 'bottom',
      'text-keep-upright': true,
    },
    paint: {
      'text-color': '#cbd5e1', // slate-300
      'text-halo-color': '#020617', // slate-950
      'text-halo-width': 3
    }
  },
  {
    id: 'skeleton-plot-labels',
    type: 'symbol',
    source: 'skeleton-source',
    filter: ['==', 'type', 'plot_label'],
    layout: {
      'symbol-placement': 'point',
      'text-field': [
        'format',
        ['get', 'plotNumber'], { 'font-scale': 1.6 },
        '\n', {},
        ['get', 'facingArrow'], { 'font-scale': 1.0 }
      ],
      'text-size': 14,
      'text-justify': 'center'
    },
    paint: {
      'text-color': '#f8fafc',
      'text-halo-color': '#020617',
      'text-halo-width': 4
    }
  },
  {
    id: 'skeleton-road-labels',
    type: 'symbol',
    source: 'skeleton-source',
    filter: ['==', 'type', 'road_label'],
    layout: {
      'symbol-placement': 'line',
      'text-field': ['get', 'widthText'],
      'text-size': 15,
      'text-letter-spacing': 0.1
    },
    paint: {
      'text-color': '#94a3b8',
      'text-halo-color': '#020617',
      'text-halo-width': 3
    }
  }
];
