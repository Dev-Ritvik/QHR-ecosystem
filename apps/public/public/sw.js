const CACHE_NAME = 'presentation-prefetch-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);
  
  // Bypass Next.js dev server hot-reloading and non-http protocols
  if (url.pathname.includes('/_next/webpack-hmr') || !url.protocol.startsWith('http')) return;

  const isStaticAsset = url.pathname.includes('/_next/static/') || 
                        url.pathname.includes('/tiles/') || 
                        url.hostname.includes('maptiler') ||
                        (url.hostname.includes('supabase.co') && url.pathname.includes('/storage/')) ||
                        event.request.destination === 'image' ||
                        event.request.destination === 'font';

  if (isStaticAsset) {
    // Strategy: Cache First, fallback to Network (Stale-While-Revalidate pattern)
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) {
          // Background revalidate
          fetch(event.request).then(res => {
            // Only update cache with valid OK or opaque (CORS) responses
            if (res && (res.status === 200 || res.type === 'opaque' || res.type === 'cors')) {
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, res));
            }
          }).catch(() => {});
          return cached;
        }
        
        return fetch(event.request).then(res => {
          if (!res || (res.status !== 200 && res.type !== 'opaque' && res.type !== 'cors')) {
            return res;
          }
          const resClone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
          return res;
        });
      })
    );
  } else {
    // Strategy: Network First, fallback to Cache (Data, Pages, Projection API)
    event.respondWith(
      fetch(event.request).then(res => {
        if (!res || res.status !== 200) {
          return res;
        }
        const resClone = res.clone();
        caches.open(CACHE_NAME).then(cache => {
          // Track staleness internally by injecting a timestamp header into the cached response
          const headers = new Headers(resClone.headers);
          headers.append('x-sw-fetched-on', new Date().getTime().toString());
          
          resClone.blob().then(body => {
            cache.put(event.request, new Response(body, {
              status: resClone.status,
              statusText: resClone.statusText,
              headers: headers
            }));
          });
        });
        return res;
      }).catch(async (err) => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(event.request);
        
        if (cached) {
          const fetchedOn = cached.headers.get('x-sw-fetched-on');
          if (fetchedOn) {
            const ageMins = (new Date().getTime() - parseInt(fetchedOn, 10)) / 60000;
            console.log(`[SW] Operating offline. Serving from durable cache. Data staleness: ${ageMins.toFixed(1)} mins`);
          }
          return cached;
        }
        throw err;
      })
    );
  }
});
