const CACHE_NAME = 'sharecar-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install event
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache).catch(() => {
        // Si hay error al cachear, continuamos de todas formas
        console.log('Algunos recursos no pudieron ser cacheados');
      });
    })
  );
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - Network first, then cache
self.addEventListener('fetch', event => {
  const { request } = event;

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // API requests: network first
  if (request.url.includes('localhost:4000')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const clonedResponse = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, clonedResponse);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then(cachedResponse => {
            return cachedResponse || new Response(
              JSON.stringify({ error: 'No hay conexión' }),
              { status: 503, headers: { 'Content-Type': 'application/json' } }
            );
          });
        })
    );
    return;
  }

  // Static assets: cache first
  event.respondWith(
    caches.match(request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request).then(response => {
          if (!response || response.status !== 200 || response.type === 'error') {
            return response;
          }

          const clonedResponse = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, clonedResponse);
          });

          return response;
        });
      })
      .catch(() => {
        // Return offline page or default response
        return new Response(
          JSON.stringify({ error: 'Recurso no disponible' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      })
  );
});

// Background sync para sincronizar datos offline
self.addEventListener('sync', event => {
  if (event.tag === 'sync-rentals') {
    event.waitUntil(
      // Aquí iría la lógica para sincronizar rentas guardadas offline
      Promise.resolve()
    );
  }
});

// Periodic background sync
self.addEventListener('periodicsync', event => {
  if (event.tag === 'update-vehicles') {
    event.waitUntil(
      fetch('http://localhost:4000/vehicles-catalog')
        .then(response => response.json())
        .then(data => {
          // Cachear datos actualizados
          return caches.open(CACHE_NAME).then(cache => {
            return cache.put(
              'http://localhost:4000/vehicles-catalog',
              new Response(JSON.stringify(data))
            );
          });
        })
        .catch(() => {
          console.log('Error actualizando catálogo de vehículos');
        })
    );
  }
});
