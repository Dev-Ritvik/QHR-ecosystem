// apps/public/src/components/map/SiteProjectMap.tsx
//
// Marketing-site map. Consumes ProjectMapData from getProjectMapData() —
// server-serialized GeoJSON, never raw WKB (the defect that broke the old
// path). Reuses the pure layer-spec modules; does NOT touch ProjectMap.tsx
// or anything presentation-mode.
//
// Degradation ladder:
//   1. No MapTiler key, no centroid, or engine failure → <MapLocationFallback>
//      (a real designed state that still communicates the location via POIs).
//   2. Key + centroid, zero geometry features (current live reality:
//      geometry_pub = 0 rows) → location/connectivity map: basemap centered
//      on the true centroid + POI markers.
//   3. Geometry present → plot/boundary layers appear (progressive enhancement).
'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { projectLayers, addMapPatterns } from './plot-layers';
import { POI_LAYERS } from './poi-layers';
import type { ProjectMapData } from '@/lib/projection';
import { MapLocationFallback } from './MapLocationFallback';

type SiteProjectMapProps = {
  data: ProjectMapData;
  projectName: string;
  locality?: string | null;
  city?: string | null;
  /** Override for tests/harnesses only; defaults to the MapTiler style with the env key. */
  styleUrl?: string;
  className?: string;
};

export function SiteProjectMap({ data, projectName, locality, city, styleUrl, className }: SiteProjectMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [failed, setFailed] = useState(false);

  const apiKey = process.env.NEXT_PUBLIC_MAPTILER_API_KEY;
  const resolvedStyle = styleUrl ?? (apiKey ? `https://api.maptiler.com/maps/basic-v2/style.json?key=${apiKey}` : null);
  const center = data.centroid?.coordinates ?? null;
  const canRender = Boolean(resolvedStyle && center);

  useEffect(() => {
    if (!canRender || failed || !containerRef.current || mapRef.current) return;

    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: resolvedStyle!,
        center: center as [number, number],
        zoom: data.features.length > 0 ? 16 : 14,
        attributionControl: { compact: true },
      });
    } catch (err) {
      console.warn('[SiteProjectMap] map constructor failed, showing designed fallback:', err);
      setFailed(true);
      return;
    }
    mapRef.current = map;

    // Fatal = the map never became usable (style/auth/CSP failure before the
    // 'load' event) or the GL context died. Post-load tile/glyph fetch
    // failures are cosmetic and must NOT hide a working map.
    let loaded = false;
    map.on('error', (e) => {
      const msg = e.error?.message ?? '';
      if (!loaded || msg.includes('WebGL')) {
        // Name the reason — a silently dead map is how this feature broke last time.
        console.warn('[SiteProjectMap] fatal map error, showing designed fallback:', msg);
        setFailed(true);
      }
    });

    map.on('load', () => {
      loaded = true;
      try {
        addMapPatterns(map);

        map.addSource('project-geometry', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: data.features as any },
        });
        if (data.features.length > 0) {
          projectLayers.forEach((l) => map.addLayer(l as any));
        }

        map.addSource('poi-source', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: data.pois as any },
        });
        POI_LAYERS.forEach((l) => map.addLayer(l as any));

        if (data.bbox) {
          map.fitBounds(data.bbox as [number, number, number, number], { padding: 48, duration: 0 });
        }
      } catch (err) {
        console.warn('[SiteProjectMap] layer setup failed, showing designed fallback:', err);
        setFailed(true);
      }
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [canRender, failed, resolvedStyle, center, data]);

  if (!canRender || failed) {
    return (
      <MapLocationFallback
        projectName={projectName}
        locality={locality}
        city={city}
        pois={data.pois}
        className={className}
      />
    );
  }

  return <div ref={containerRef} className={className ?? 'h-full w-full'} data-testid="site-map-live" />;
}
