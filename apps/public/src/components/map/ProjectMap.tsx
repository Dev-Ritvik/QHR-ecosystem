// apps/public/src/components/map/ProjectMap.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as Sentry from '@sentry/nextjs';
import { applyCameraPreset, EXTRUSION_LAYERS } from './camera-presets';
import { projectLayers, addMapPatterns } from './plot-layers';
import { buildPoiGeoJSON, POI_LAYERS } from './poi-layers';
import { buildSkeletonGeoJSON, SKELETON_LAYERS } from './skeleton-view';

export type ViewMode = '2d' | 'skeleton' | '3d' | 'connectivity';

type ProjectMapProps = {
  project: any;
  units: any[];
  geometry: any[];
  pois: any[];
  viewMode?: ViewMode;
  selectedUnitId?: string | null;
  onUnitSelect?: (id: string) => void;
};

export function ProjectMap({ project, units, geometry, pois, viewMode = 'skeleton', selectedUnitId, onUnitSelect }: ProjectMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [mapFailed, setMapFailed] = useState(false);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    try {
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: `https://api.maptiler.com/maps/basic-v2/style.json?key=${process.env.NEXT_PUBLIC_MAPTILER_API_KEY}`,
        center: project.centroid?.coordinates || [0, 0],
        zoom: 16,
        interactive: false,
      });

      // FR-PM11: Catch MapLibre-level engine failures silently
      map.current.on('error', (e) => {
        Sentry.captureException(e.error || new Error('MapLibre internal error'), {});
        
        // Critical WebGL or style load failure trips the fallback
        if (e.error?.message?.includes('WebGL') || e.error?.message?.includes('style')) {
          setMapFailed(true);
        }
      });

      map.current.on('load', () => {
        if (!map.current) return;
        try {
          addMapPatterns(map.current);

          if (!map.current.getSource('project-geometry')) {
             map.current.addSource('project-geometry', { type: 'geojson', data: { type: 'FeatureCollection', features: geometry } });
          }
          projectLayers.forEach(l => { if (!map.current!.getLayer(l.id)) map.current!.addLayer(l); });
          EXTRUSION_LAYERS.forEach(l => { if (!map.current!.getLayer(l.id)) map.current!.addLayer(l); });

          if (!map.current.getSource('poi-source')) {
             map.current.addSource('poi-source', { type: 'geojson', data: buildPoiGeoJSON(pois) });
          }
          POI_LAYERS.forEach(l => { if (!map.current!.getLayer(l.id)) map.current!.addLayer(l); });

          if (!map.current.getSource('skeleton-source')) {
             map.current.addSource('skeleton-source', { type: 'geojson', data: buildSkeletonGeoJSON(geometry, units) });
          }
          SKELETON_LAYERS.forEach(l => { if (!map.current!.getLayer(l.id)) map.current!.addLayer(l); });

          applyCameraPreset(map.current, viewMode, project.centroid?.coordinates || [0, 0]);
        } catch (err) {
          Sentry.captureException(err, {});
        }
      });

    } catch (err) {
      Sentry.captureException(err, {});
      setMapFailed(true);
    }

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [project, geometry, pois, units, selectedUnitId, viewMode]);

  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return;
    try {
      applyCameraPreset(map.current, viewMode, project.centroid?.coordinates || [0, 0]);
    } catch (err) {
      Sentry.captureException(err, {});
    }
  }, [viewMode, project]);

  if (mapFailed) {
    // FR-PM11: Designed fallback for asset failure. No alert, no stack trace.
    return (
      <div className="w-full h-full bg-slate-900 absolute inset-0 z-0 flex items-center justify-center">
        <img 
          src="/fallbacks/map-placeholder.jpg" 
          alt="Map view unavailable" 
          className="w-full h-full object-cover opacity-40"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      </div>
    );
  }

  return <div ref={mapContainer} className="w-full h-full absolute inset-0 z-0" />;
}
