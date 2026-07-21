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
        <h2 className="text-2xl font-bold">Location & Connectivity</h2>
        <EmptyStates type="location" />
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold">Location & Connectivity</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Map Column */}
        <div className="lg:col-span-2 h-[450px] bg-gray-100 rounded-xl overflow-hidden relative border border-gray-200">
          <div ref={mapContainer} className="absolute inset-0" />
        </div>

        {/* List Column */}
        <div className="space-y-3 max-h-[450px] overflow-y-auto pr-2">
          {pois.map((poi) => (
            <div key={poi.poiId} className="p-4 border rounded-lg bg-white shadow-sm flex flex-col gap-1 transition hover:shadow-md">
              <div className="flex justify-between items-start gap-2">
                <h3 className="font-semibold text-gray-900 leading-tight">{poi.name}</h3>
                <span className="text-xs font-medium px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full whitespace-nowrap">
                  {poi.category}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-500 mt-2">
                <span className="flex items-center gap-1 font-medium text-gray-700">
                  {(poi.distanceM / 1000).toFixed(1)} km
                </span>
                {poi.driveTimeMin !== null && (
                  <span className="flex items-center gap-1">
                    • ~{poi.driveTimeMin} min drive
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
