// Beezio cleanup service worker
// Purpose: remove stale caches and then unregister itself to avoid serving old bundles.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));

    // Take control of open pages, then unregister this SW so it does not persist.
    await self.clients.claim();
    try {
      await self.registration.unregister();
    } catch (e) {
      // ignore
    }

    const clients = await self.clients.matchAll({ includeUncontrolled: true });
    clients.forEach((client) => {
      try {
        client.navigate(client.url);
      } catch (e) {
        // ignore
      }
    });
  })());
});

// Do not intercept fetch requests.
self.addEventListener('fetch', () => {});
