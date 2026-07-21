// apps/public/src/components/map/camera-presets.ts
import type { Map, LayerSpecification } from 'maplibre-gl';
import type { ViewMode } from './ProjectMap';

export const CAMERA_PRESETS: Record<ViewMode, { pitch: number; bearing: number; zoomOffset: number; duration: number }> = {
  '2d': { pitch: 0, bearing: 0, zoomOffset: 0, duration: 1200 },
  'skeleton': { pitch: 0, bearing: 0, zoomOffset: 0.5, duration: 1200 },
  '3d': { pitch: 60, bearing: -35, zoomOffset: -0.5, duration: 1800 }, // 2.5D tilt & rotation (FR-PM6b)
  'connectivity': { pitch: 0, bearing: 0, zoomOffset: -3.5, duration: 2500 }
};

/**
 * Applies a cinematic camera transition for view mode changes (ADR-003, NFR-P3).
 * If isCinematic is true, lengthens the transition and uses a dramatic cubic ease-out.
 */
export function applyCameraPreset(
  map: Map, 
  mode: ViewMode, 
  baseCenter: [number, number], 
  baseZoom: number = 17,
  isCinematic: boolean = false
) {
  const preset = CAMERA_PRESETS[mode] || CAMERA_PRESETS['2d'];
  
  map.easeTo({
    center: baseCenter,
    zoom: baseZoom + preset.zoomOffset,
    pitch: preset.pitch,
    bearing: preset.bearing,
    duration: isCinematic ? 3000 : preset.duration,
    easing: isCinematic ? (t) => 1 - Math.pow(1 - t, 3) : (t) => t * (2 - t) // Cubic ease-out for cinematic fly-in
  });
}

/**
 * 2.5D Fill-Extrusion Layers for MapLibre (FR-PM6b, ADR-003).
 * Massing, amenities, and boundaries extrude upward to give structural depth
 * without the performance cost of a full bespoke 3D scene.
 */
export const EXTRUSION_LAYERS: LayerSpecification[] = [
  {
    id: 'extrusion-massing',
    type: 'fill-extrusion',
    source: 'project-geometry',
    filter: ['==', 'featureType', 'massing'],
    paint: {
      'fill-extrusion-color': '#e2e8f0', // slate-200
      'fill-extrusion-height': ['coalesce', ['get', 'height_m'], 15],
      'fill-extrusion-base': ['coalesce', ['get', 'base_m'], 0],
      'fill-extrusion-opacity': 0.85
    }
  },
  {
    id: 'extrusion-amenity',
    type: 'fill-extrusion',
    source: 'project-geometry',
    filter: ['==', 'featureType', 'amenity'],
    paint: {
      'fill-extrusion-color': '#38bdf8', // sky-400
      'fill-extrusion-height': ['coalesce', ['get', 'height_m'], 5],
      'fill-extrusion-base': ['coalesce', ['get', 'base_m'], 0],
      'fill-extrusion-opacity': 0.9
    }
  },
  {
    id: 'extrusion-boundary',
    type: 'fill-extrusion',
    source: 'project-geometry',
    filter: ['==', 'featureType', 'boundary'],
    paint: {
      'fill-extrusion-color': '#475569', // slate-600
      'fill-extrusion-height': ['coalesce', ['get', 'height_m'], 2.5],
      'fill-extrusion-base': ['coalesce', ['get', 'base_m'], 0],
      'fill-extrusion-opacity': 1.0
    }
  },
  {
    id: 'extrusion-road',
    type: 'fill-extrusion',
    source: 'project-geometry',
    filter: ['==', 'featureType', 'road'],
    paint: {
      'fill-extrusion-color': '#334155', // slate-700
      'fill-extrusion-height': 0.1, // Subtle depth
      'fill-extrusion-base': 0,
      'fill-extrusion-opacity': 1.0
    }
  },
  {
    id: 'extrusion-plot',
    type: 'fill-extrusion',
    source: 'project-geometry',
    filter: ['==', 'featureType', 'plot'],
    paint: {
      'fill-extrusion-color': [
        'match',
        ['get', 'presentationStatus'],
        'available', '#10b981',
        'selling_fast', '#f59e0b',
        'on_hold', '#f97316',
        'booked', '#8b5cf6',
        'sold', '#64748b',
        'not_for_sale', '#d97706',
        '#64748b' // fallback
      ],
      'fill-extrusion-height': 0.2, // Minor extrusion to separate from ground plane
      'fill-extrusion-base': 0,
      'fill-extrusion-opacity': 0.6
    }
  },
  {
    id: 'extrusion-plot-highlight',
    type: 'fill-extrusion',
    source: 'project-geometry',
    filter: ['==', 'unitId', ''], // Updated dynamically on focus
    paint: {
      'fill-extrusion-color': '#ffffff',
      'fill-extrusion-height': 0.4,
      'fill-extrusion-base': 0,
      'fill-extrusion-opacity': 0.9
    }
  }
];
