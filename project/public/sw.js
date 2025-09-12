// Enhanced service worker for Beezio PWA
const CACHE_NAME = 'beezio-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/bumblebee.svg'
];

// During install, cache the application shell
self.addEventListener('install', (event) => {
  self.skipWaiting(); // activate new SW immediately
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
});

// Activate event: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => { if (k !== CACHE_NAME) return caches.delete(k); }));
      await self.clients.claim();
    })()
  );
});

// Utility: send message to all clients
async function notifyClients(msg) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  for (const client of clients) {
    client.postMessage(msg);
  }
}

// Fetch handler: network-first for navigation, cache-first for assets
self.addEventListener('fetch', (event) => {
  const request = event.request;
  // For navigation requests, try network first to ensure fresh HTML
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const networkResponse = await fetch(request);
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, networkResponse.clone()).catch(() => {});
        return networkResponse;
      } catch (err) {
        const cached = await caches.match(request);
        if (cached) return cached;
        // Fallback to index.html
        return caches.match('/index.html');
      }
    })());
    return;
  }

  // For other requests, respond with cache-first then network
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).catch(() => cached))
  );
});

// Listen for skipWaiting messages from the client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
