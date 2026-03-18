// Self-destructing Service Worker - clears old Vite cache and reloads all tabs
self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(cacheNames.map((name) => caches.delete(name)));
        }).then(() => {
            return self.clients.claim();
        }).then(() => {
            // Tell all open tabs to reload so they pick up the new Next.js build
            return self.clients.matchAll({ type: 'window' }).then(clients => {
                clients.forEach(client => client.navigate(client.url));
            });
        }).then(() => {
            return self.registration.unregister();
        })
    );
});
