/* ===== Service Worker — Ms Glow POS ===== */
/* Cache HTML, CSS, JS, manifest + icon; network-first untuk API */

const CACHE_NAME = 'ms-glow-pos-v1';
const OFFLINE_URL = '/index.html';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/@zxing/browser@1.0.0-rc.10/dist/index.min.js'
];

/* Install — cache semua aset statis */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

/* Activate — bersihkan cache lama */
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames.map(cache => {
          if (!cacheWhitelist.includes(cache)) {
            return caches.delete(cache);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

/* Fetch — Network First untuk API, Cache First untuk aset statis */
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // API call ke Google Apps Script → network first, cache fallback
  if (url.includes('script.google.com') || url.includes('script.googleusercontent.com')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Aset statis → cache first
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
      .catch(() => caches.match(OFFLINE_URL))
  );
});

/* Background sync — sync offline queue */
self.addEventListener('sync', event => {
  if (event.tag === 'ms-glow-sync') {
    event.waitUntil(
      self.clients.matchAll().then(clients => {
        clients.forEach(client => client.postMessage({ cmd: 'flush-offline' }));
      })
    );
  }
});
