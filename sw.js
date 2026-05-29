const CACHE = 'quiver-v3';
const BASE = '/quiver';
const SHELL = [
  `${BASE}/`,
  `${BASE}/index.html`,
  `${BASE}/styles.css`,
  `${BASE}/manifest.json`,
  `${BASE}/js/main.js`,
  `${BASE}/js/data/achievements.js`,
  `${BASE}/js/data/analytics.js`,
  `${BASE}/js/data/stages.js`,
  `${BASE}/js/data/storage.js`,
  `${BASE}/js/game/dragdrop.js`,
  `${BASE}/js/game/ui.js`,
  `${BASE}/js/game/validator.js`,
  `${BASE}/js/quantum/bloch.js`,
  `${BASE}/js/quantum/engine.js`,
  `${BASE}/js/quantum/gates.js`,
  `${BASE}/assets/logo.jpg`,
  `${BASE}/assets/icon.png`,
  `${BASE}/assets/apple-touch-icon.png`,
  `${BASE}/assets/icon-192.png`,
  `${BASE}/assets/icon-512.png`,
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
