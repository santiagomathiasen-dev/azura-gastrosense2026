const CACHE_VERSION = 'v2';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const IMAGE_CACHE = `images-${CACHE_VERSION}`;

const STATIC_EXTENSIONS = /\.(js|css|woff2?|ttf|eot)(\?.*)?$/;
const IMAGE_EXTENSIONS = /\.(png|jpg|jpeg|gif|webp|svg|ico)(\?.*)?$/;
const API_HOSTS = ['supabase.co', 'supabase.in'];

// --- Install: pre-cache nothing (let runtime caching handle it) ---
self.addEventListener('install', () => {
  self.skipWaiting();
});

// --- Activate: delete old caches ---
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== IMAGE_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// --- Fetch: route-based caching strategy ---
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Supabase API → network-first (never cache auth/data)
  if (API_HOSTS.some((h) => url.hostname.includes(h))) {
    event.respondWith(networkFirst(request));
    return;
  }

  // 2. Next.js static assets (/_next/static/) → stale-while-revalidate
  if (url.pathname.startsWith('/_next/static/') || STATIC_EXTENSIONS.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
    return;
  }

  // 3. Images (Supabase Storage public URLs handled separately above)
  if (IMAGE_EXTENSIONS.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE));
    return;
  }

  // 4. Navigation requests → network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  // 5. Everything else → network only
  event.respondWith(fetch(request));
});

// --- Strategies ---

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);

  return cached || fetchPromise;
}
