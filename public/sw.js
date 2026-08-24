const CACHE_NAME = 'dd-homeinvest-v4';
const STATIC_CACHE = 'dd-homeinvest-static-v4';
// Dynamické cesty (API a obrázky z R2) se nikdy necachují v service workeru
const DYNAMIC_CONTENT_PATTERN = /^\/(api\/|media\/)/;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) =>
        Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE) {
              return caches.delete(cacheName);
            }
            return undefined;
          }),
        ),
      ),
      self.clients.claim(),
    ]),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== 'GET') {
    return;
  }

  if (DYNAMIC_CONTENT_PATTERN.test(url.pathname)) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (url.pathname.endsWith('.html') || url.pathname.endsWith('.htm') || url.pathname === '/') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request)),
    );
    return;
  }

  if (url.pathname.match(/\.(css|js|jpg|jpeg|png|gif|svg|webp|ico)$/)) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        if (response) {
          const cacheDate = response.headers.get('date');
          if (cacheDate) {
            const cacheTime = new Date(cacheDate).getTime();
            const now = Date.now();
            const fiveMinutes = 5 * 60 * 1000;

            if (now - cacheTime > fiveMinutes) {
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

        return fetch(event.request).then((response) => {
          const responseToCache = response.clone();
          caches.open(STATIC_CACHE).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return response;
        });
      }),
    );
    return;
  }

  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
