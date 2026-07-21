'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

interface PoiMapPickerProps {
  centroid?: { type: 'Point', coordinates: [number, number] } | null;
  selectedLocation: [number, number] | null;
  onLocationSelect: (loc: [number, number]) => void;
  label?: string;
}

export function PoiMapPicker({ centroid, selectedLocation, onLocationSelect, label = 'Click map to place POI pin' }: PoiMapPickerProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const marker = useRef<maplibregl.Marker | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Callers often pass inline callbacks / freshly-parsed centroids; keep the
  // latest values in refs so the map initialises exactly once instead of
  // being torn down and rebuilt on every parent re-render (which ate clicks).
  const onLocationSelectRef = useRef(onLocationSelect);
  onLocationSelectRef.current = onLocationSelect;
  const initialViewRef = useRef({ selectedLocation, centroid });

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const apiKey = process.env.NEXT_PUBLIC_MAPTILER_API_KEY;
    if (!apiKey) {
      console.error('Missing NEXT_PUBLIC_MAPTILER_API_KEY');
      return;
    }

    // Prefer an existing pin (edit mode), then the project centroid, then a
    // country-wide fallback.
    const initial = initialViewRef.current;
    const initialCenter: [number, number] =
      initial.selectedLocation || initial.centroid?.coordinates || [79.0, 21.0];
    const zoom = initial.selectedLocation || initial.centroid ? 14 : 4;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${apiKey}`,
      center: initialCenter,
      zoom,
    });

    map.current.on('load', () => {
      setMapLoaded(true);
    });

    map.current.on('click', (e) => {
      const loc: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      onLocationSelectRef.current(loc);
    });

    return () => {
      marker.current?.remove();
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Update marker position when selectedLocation changes
  useEffect(() => {
    if (!map.current || !mapLoaded || !selectedLocation) return;

    if (!marker.current) {
      marker.current = new maplibregl.Marker({ color: '#FF0000' })
        .setLngLat(selectedLocation)
        .addTo(map.current);
    } else {
      marker.current.setLngLat(selectedLocation);
    }
  }, [selectedLocation, mapLoaded]);

  return (
    <div className="relative w-full h-64 bg-gray-100 rounded border overflow-hidden">
      <div ref={mapContainer} className="w-full h-full absolute inset-0" />
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-75 z-10 text-sm text-gray-500">
          Loading map...
        </div>
      )}
      <div className="absolute top-2 left-2 bg-white/90 backdrop-blur px-2 py-1 text-xs rounded border shadow-sm z-10 pointer-events-none">
        {label}
      </div>
    </div>
  );
}
