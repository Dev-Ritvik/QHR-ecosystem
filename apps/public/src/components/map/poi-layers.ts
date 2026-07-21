// apps/public/src/components/map/poi-layers.ts
import type { FeatureCollection, Feature } from 'geojson';
import type { LayerSpecification } from 'maplibre-gl';

/**
 * Transforms the standard pois_pub data into a GeoJSON source
 * for the FR-PM6c connectivity view.
 */
export function buildPoiGeoJSON(pois: any[]): FeatureCollection {
  const features: Feature[] = pois.map((poi) => {
    // Combine distance and drive time into a single metadata label
    let meta = `${(poi.distanceM / 1000).toFixed(1)} km`;
    if (poi.driveTimeMin !== null && poi.driveTimeMin !== undefined) {
      meta += ` • ~${poi.driveTimeMin} min`;
    }
    
    return {
      type: 'Feature',
      geometry: poi.location,
      properties: {
        id: poi.poiId,
        name: poi.name,
        category: poi.category,
        metaLabel: meta,
        // Used by symbol-sort-key to ensure high-relevance POIs render on top (FR-W5)
        sortOrder: poi.sortOrder,
      }
    };
  });

  return { type: 'FeatureCollection', features };
}

export const POI_LAYERS: LayerSpecification[] = [
  {
    id: 'poi-points',
    type: 'circle',
    source: 'poi-source',
    paint: {
      'circle-radius': 6,
      'circle-color': '#3b82f6', // blue-500
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
    },
  },
  {
    id: 'poi-labels',
    type: 'symbol',
    source: 'poi-source',
    layout: {
      'text-field': [
        'format', 
        ['get', 'name'], {}, 
        '\n', {}, 
        ['get', 'metaLabel'], { 'font-scale': 0.85 }
      ],
      'text-size': 15,
      'text-anchor': 'left',
      'text-offset': [0.8, 0],
      'symbol-sort-key': ['get', 'sortOrder'],
      'text-justify': 'left',
    },
    paint: {
      'text-color': '#f8fafc',
      'text-halo-color': 'rgba(0,0,0,0.8)',
      'text-halo-width': 2,
    },
  },
];
