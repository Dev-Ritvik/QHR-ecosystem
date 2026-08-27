// apps/public/src/components/site/LocationSection.tsx
'use client';

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { EmptyStates } from './EmptyStates';

interface POI {
  poiId: string;
  name: string;
  category: string;
  distanceM: number;
  driveTimeMin: number | null;
  location: any; // GeoJSON point
}

interface LocationSectionProps {
  pois: POI[];
  projectCentroid: any; // GeoJSON point
}

export function LocationSection({ pois, projectCentroid }: LocationSectionProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const apiKey = process.env.NEXT_PUBLIC_MAPTILER_API_KEY;
    const styleUrl = `https://api.maptiler.com/maps/streets-v2/style.json?key=${apiKey}`;

    const center: [number, number] = projectCentroid?.coordinates 
      ? [projectCentroid.coordinates[0], projectCentroid.coordinates[1]]
      : [78.4867, 17.3850]; // Fallback coordinates

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: styleUrl,
      center: center,
      zoom: 12,
      attributionControl: false,
      scrollZoom: false,
    });

    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    // Add Project Marker
    if (projectCentroid?.coordinates) {
      new maplibregl.Marker({ color: '#111827' }) // Dark gray for the primary project marker
        .setLngLat(center)
        .addTo(map.current);
    }

    // Add POI Markers
    pois.forEach((poi) => {
      if (poi.location?.coordinates) {
        const popup = new maplibregl.Popup({ offset: 25, closeButton: false }).setText(poi.name);
        new maplibregl.Marker({ color: '#3b82f6', scale: 0.8 }) // Blue for POIs
          .setLngLat([poi.location.coordinates[0], poi.location.coordinates[1]])
          .setPopup(popup)
          .addTo(map.current!);
      }
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [pois, projectCentroid]);

  if (!pois || pois.length === 0) {
    return (
      <section className="space-y-6">
        <h2 className="t-h2 text-[#F2EDE4]">Location &amp; connectivity</h2>
        <EmptyStates type="location" />
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <h2 className="t-h2 text-[#F2EDE4]">Location &amp; connectivity</h2>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Map Column */}
        <div className="relative h-[450px] overflow-hidden rounded-sm border border-white/10 bg-white/[0.02] lg:col-span-2">
          <div ref={mapContainer} className="absolute inset-0" />
        </div>

        {/* List Column. Distances are the load-bearing fact here, so they are
            tabular and given the accent; the category is demoted to a label. */}
        <ul className="max-h-[450px] space-y-px overflow-y-auto">
          {pois.map((poi) => (
            <li
              key={poi.poiId}
              className="flex flex-col gap-2 border-b border-white/10 px-1 py-4"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-[15px] leading-snug text-[#F2EDE4]">{poi.name}</h3>
                <span className="t-eyebrow shrink-0 whitespace-nowrap text-[#F2EDE4]/50">
                  {poi.category}
                </span>
              </div>
              <div
                className="flex items-center gap-3 text-sm text-[#F2EDE4]/60"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                <span className="text-[#E8B98A]">
                  {(poi.distanceM / 1000).toFixed(1)} km
                </span>
                {poi.driveTimeMin !== null && (
                  <span>&middot; ~{poi.driveTimeMin} min drive</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
