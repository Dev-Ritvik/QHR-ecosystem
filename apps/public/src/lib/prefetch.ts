// apps/public/src/lib/prefetch.ts
import { CapabilityTier } from './capability-probe';

const CACHE_NAME = 'presentation-cache-v1';

// Web Mercator slippy map tile math
function lon2tile(lon: number, zoom: number) {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
}

function lat2tile(lat: number, zoom: number) {
  return Math.floor(
    ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) *
      Math.pow(2, zoom)
  );
}

function getTileUrls(bbox: [number, number, number, number], apiKey: string): string[] {
  const urls: string[] = [];
  const [minLng, minLat, maxLng, maxLat] = bbox;
  
  // Target zoom levels for the presentation 2.5D/Top-down views (FR-PM6)
  const zooms = [15, 16, 17];
  
  for (const z of zooms) {
    const minX = lon2tile(minLng, z);
    const maxX = lon2tile(maxLng, z);
    const minY = lat2tile(maxLat, z); // maxLat gives min Y (Y grows downwards)
    const maxY = lat2tile(minLat, z);
    
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        // Standard MapTiler vector tile URL structure
        urls.push(`https://api.maptiler.com/tiles/v3/${z}/${x}/${y}.pbf?key=${apiKey}`);
      }
    }
  }
  return urls;
}

/**
 * Focus-triggered prefetch of the project bundle (FR-PM2, NFR-P2).
 * Caches HTML, imagery, and map tiles into Cache Storage for instant loads
 * and offline resilience (FR-PM10).
 */
export async function prefetchProjectBundle(project: any, tier: CapabilityTier) {
  if (typeof window === 'undefined' || !('caches' in window)) return;
  
  try {
    const cache = await caches.open(CACHE_NAME);
    const urlsToCache = new Set<string>();
    
    // 1. Next.js Route (HTML payload for offline and fast navigation)
    urlsToCache.add(`/p/${project.slug}`);
    
    // 2. Hero Imagery
    if (project.heroUrl) {
      urlsToCache.add(project.heroUrl);
    }
    
    // 3. Map Style & BBox Tile Pack
    const apiKey = process.env.NEXT_PUBLIC_MAPTILER_API_KEY;
    if (apiKey) {
      urlsToCache.add(`https://api.maptiler.com/maps/streets-v2/style.json?key=${apiKey}`);
      
      if (project.bbox && Array.isArray(project.bbox) && project.bbox.length === 4) {
        const tileUrls = getTileUrls(project.bbox as [number, number, number, number], apiKey);
        
        // Cap at 50 tiles to prevent network flooding on focus while still covering the project area
        tileUrls.slice(0, 50).forEach(url => urlsToCache.add(url));
      }
    }
    
    // 4. Fetch uncached resources non-blocking
    const fetchPromises = Array.from(urlsToCache).map(async (url) => {
      try {
        const cachedResponse = await cache.match(url);
        if (!cachedResponse) {
          // Use 'cors' mode for tiles/images to allow opaque caching
          const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
          if (response.ok) {
            await cache.put(url, response);
          }
        }
      } catch (e) {
        // Silent failure in presentation mode (FR-PM11)
        // Failure to prefetch just gracefully degrades to fetching at load time
      }
    });

    // Fire and forget
    Promise.all(fetchPromises);
    
  } catch (error) {
    console.error('Prefetch initialization failed:', error);
  }
}
