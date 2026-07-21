// apps/public/src/components/map/plot-layers.ts
import type { LayerSpecification, Map } from 'maplibre-gl';

export const STATUS_COLORS = {
  available: '#22c55e',     // green-500
  selling_fast: '#f97316',  // orange-500
  on_hold: '#eab308',       // yellow-500
  booked: '#3b82f6',        // blue-500
  sold: '#64748b',          // slate-500
  not_for_sale: '#d97706'   // amber-600 — "Mortgage" bucket in the owner's 4-state view
};

export const addMapPatterns = (map: Map) => {
  // NFR-A3: Create simple SVG hatch patterns for statuses to provide a secondary visual channel
  const createPattern = (color: string) => {
    const svg = `<svg width="12" height="12" xmlns="http://www.w3.org/2000/svg"><path d="M-2,2 l4,-4 M0,12 l12,-12 M10,14 l4,-4" stroke="${color}" stroke-opacity="0.6" stroke-width="2"/></svg>`;
    return `data:image/svg+xml;base64,${typeof window !== 'undefined' ? window.btoa(svg) : ''}`;
  };

  const loadPattern = (id: string, color: string) => {
    const img = new Image();
    img.onload = () => {
      if (!map.hasImage(id)) {
        map.addImage(id, img);
      }
    };
    img.src = createPattern(color);
  };

  loadPattern('pattern-selling_fast', STATUS_COLORS.selling_fast);
  loadPattern('pattern-on_hold', STATUS_COLORS.on_hold);
  loadPattern('pattern-booked', STATUS_COLORS.booked);
  loadPattern('pattern-sold', STATUS_COLORS.sold);
  loadPattern('pattern-not_for_sale', STATUS_COLORS.not_for_sale);
};

const baseFeatureLayers: LayerSpecification[] = [
  {
    id: 'feature-boundary',
    type: 'line',
    source: 'project-geometry',
    filter: ['==', 'featureType', 'boundary'],
    paint: {
      'line-color': '#94a3b8',
      'line-dasharray': [2, 2],
      'line-width': 2
    }
  },
  {
    id: 'feature-road',
    type: 'fill',
    source: 'project-geometry',
    filter: ['==', 'featureType', 'road'],
    paint: {
      'fill-color': '#e2e8f0',
      'fill-opacity': 0.8
    }
  },
  {
    id: 'feature-amenity',
    type: 'fill',
    source: 'project-geometry',
    filter: ['==', 'featureType', 'amenity'],
    paint: {
      'fill-color': '#dcfce7',
      'fill-opacity': 0.6
    }
  }
];

const plotLayers: LayerSpecification[] = [
  {
    id: 'plot-fill',
    type: 'fill',
    source: 'project-geometry',
    filter: ['==', 'featureType', 'plot'],
    paint: {
      'fill-color': [
        'match',
        ['get', 'presentationStatus'],
        'available', STATUS_COLORS.available,
        'selling_fast', STATUS_COLORS.selling_fast,
        'on_hold', STATUS_COLORS.on_hold,
        'booked', STATUS_COLORS.booked,
        'sold', STATUS_COLORS.sold,
        'not_for_sale', STATUS_COLORS.not_for_sale,
        '#cbd5e1'
      ],
      'fill-opacity': 0.15
    }
  },
  {
    id: 'plot-pattern',
    type: 'fill',
    source: 'project-geometry',
    filter: ['all', ['==', 'featureType', 'plot'], ['!=', 'presentationStatus', 'available']],
    paint: {
      'fill-pattern': [
        'match',
        ['get', 'presentationStatus'],
        'selling_fast', 'pattern-selling_fast',
        'on_hold', 'pattern-on_hold',
        'booked', 'pattern-booked',
        'sold', 'pattern-sold',
        'not_for_sale', 'pattern-not_for_sale',
        ''
      ],
      'fill-opacity': 0.9
    }
  },
  {
    id: 'plot-line',
    type: 'line',
    source: 'project-geometry',
    filter: ['==', 'featureType', 'plot'],
    paint: {
      'line-color': [
        'match',
        ['get', 'presentationStatus'],
        'available', STATUS_COLORS.available,
        'selling_fast', STATUS_COLORS.selling_fast,
        'on_hold', STATUS_COLORS.on_hold,
        'booked', STATUS_COLORS.booked,
        'sold', STATUS_COLORS.sold,
        'not_for_sale', STATUS_COLORS.not_for_sale,
        '#cbd5e1'
      ],
      'line-width': 2
    }
  },
  {
    id: 'plot-label-number',
    type: 'symbol',
    source: 'project-geometry',
    filter: ['==', 'featureType', 'plot'],
    minzoom: 16,
    layout: {
      'text-field': ['get', 'plotNumber'],
      'text-font': ['Noto Sans Bold', 'Open Sans Bold', 'Arial Unicode MS Bold'],
      'text-size': 14,
      'text-anchor': 'center'
    },
    paint: {
      'text-color': '#1e293b',
      'text-halo-color': '#ffffff',
      'text-halo-width': 2
    }
  },
  {
    id: 'plot-label-facing',
    type: 'symbol',
    source: 'project-geometry',
    filter: ['all', ['==', 'featureType', 'plot'], ['has', 'facing']],
    minzoom: 18,
    layout: {
      'text-field': ['get', 'facing'],
      'text-font': ['Noto Sans Regular', 'Open Sans Regular', 'Arial Unicode MS Regular'],
      'text-size': 11,
      'text-offset': [0, 1.5],
      'text-anchor': 'top'
    },
    paint: {
      'text-color': '#64748b',
      'text-halo-color': '#ffffff',
      'text-halo-width': 1.5
    }
  }
];

export const projectLayers: LayerSpecification[] = [...baseFeatureLayers, ...plotLayers];
