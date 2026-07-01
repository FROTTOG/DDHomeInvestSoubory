const CACHE_NAME = 'dd-homeinvest-v2';
const STATIC_CACHE = 'dd-homeinvest-static-v2';

// Install event - skip waiting to activate new SW immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate event - clean up old caches and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE) {
              return caches.delete(cacheName);
            }
          })
        );
      }),
      self.clients.claim()
    ])
  );
});

// Fetch event - network-first for HTML, cache-first for assets with short TTL
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // HTML files - always network-first (no cache)
  if (url.pathname.endsWith('.html') || url.pathname.endsWith('.htm') || url.pathname === '/') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Don't cache HTML
          return response;
        })
        .catch(() => {
          // Fallback to cache only if network fails
          return caches.match(event.request);
        })
    );
    return;
  }
  
  // Static assets (CSS, JS, images) - cache with short TTL
  if (url.pathname.match(/\.(css|js|jpg|jpeg|png|gif|svg|webp|ico)$/)) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        if (response) {
          // Check if cache is older than 5 minutes
          const cacheDate = response.headers.get('date');
          if (cacheDate) {
            const cacheTime = new Date(cacheDate).getTime();
            const now = Date.now();
            const fiveMinutes = 5 * 60 * 1000;
            
            if (now - cacheTime > fiveMinutes) {
              // Cache is stale, fetch fresh
              return fetch(event.request).then((freshResponse) => {
                const responseToCache = freshResponse.clone();
                caches.open(STATIC_CACHE).then((cache) => {
                  cache.put(event.request, responseToCache);
                });
                return freshResponse;
              });
            }
          }
          return response;
        }
        
        // Not in cache, fetch and cache
        return fetch(event.request).then((response) => {
          const responseToCache = response.clone();
          caches.open(STATIC_CACHE).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return response;
        });
      })
    );
    return;
  }
  
  // Other requests - network-first
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
