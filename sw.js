const CACHE_NAME = 'topclash-v5.1.4';
const CORE_ASSETS = [
  './',
  './index.html',
  './armory.html',
  './style.css',
  './manifest.json',
  './js/data.js',
  './js/ladder-data.js',
  './js/engine.js',
  './js/cloud-sync.js',
  './js/ladder.js',
  './js/tournament.js',
  './js/firebase-tourney.js',
  './js/online-pvp.js',
  './js/telemetry.js',
  './js/app.js',
  './js/armory.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.allSettled(CORE_ASSETS.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Cache-first for unit artwork images
  if (url.pathname.includes('/assets/units/')) {
    event.respondWith(
      caches.match(req, { ignoreSearch: true }).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        });
      })
    );
    return;
  }

  // Network-first (bypassing stale HTTP browser cache) for HTML/CSS/JS so updates take effect immediately
  event.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }))
  );
});
