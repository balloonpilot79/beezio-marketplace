// Cleanup service worker - unregisters itself and clears caches// Cleanup service worker - unregisters itself and clears caches

self.addEventListener('install', (event) => {self.addEventListener('install', (event) => {

  // Skip waiting to activate immediately    // Skip waiting to activate immediately

  self.skipWaiting();  self.skipWaiting();

});});



self.addEventListener('activate', (event) => {self.addEventListener('activate', (event) => {

  event.waitUntil(  event.waitUntil(

    // Delete ALL caches to clean up    (async () => {

    Promise.all([      const keys = await caches.keys();

      caches.keys().then(cacheNames =>       await Promise.all(keys.map(k => { if (k !== CACHE_NAME) return caches.delete(k); }));

        Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)))      await self.clients.claim();

      ),    })()

      // Reload all clients to clear any cached auth issues  );

      self.clients.matchAll().then(clients => {});

        clients.forEach(client => {

          try {// Utility: send message to all clients

            client.postMessage({ type: 'SW_CLEANUP_COMPLETE' });async function notifyClients(msg) {

          } catch (e) {  const clients = await self.clients.matchAll({ includeUncontrolled: true });

            // Ignore errors  for (const client of clients) {

          }    client.postMessage(msg);

        });  }

      })}

    ])

  );// Fetch handler: network-first for navigation, cache-first for assets

});self.addEventListener('fetch', (event) => {

  const request = event.request;

// Don't intercept any fetch requests - let everything go to network  const url = new URL(request.url);

self.addEventListener('fetch', (event) => {

  // Do nothing - let all requests go through normally to fix auth issues  // Skip service worker for development resources

});  if (url.pathname.startsWith('/@') ||
      url.pathname.endsWith('.tsx') ||
      url.pathname.endsWith('.ts') ||
      url.pathname.includes('hot-update') ||
      url.hostname !== location.hostname) {
    return; // Let the request go through normally
  }

  // For navigation requests, try network first to ensure fresh HTML
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const networkResponse = await fetch(request);
        // Only cache successful responses (status 200) to avoid caching 404/500 pages
        if (networkResponse && networkResponse.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, networkResponse.clone()).catch(() => {});
          return networkResponse;
        }
        // If server returned non-OK (like 404), don't cache it. Prefer returning index.html from cache
        const fallback = await caches.match('/index.html');
        if (fallback) return fallback;
        return networkResponse;
      } catch (err) {
        const cached = await caches.match(request);
        if (cached && cached.ok) return cached;
        // Fallback to index.html if available
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
