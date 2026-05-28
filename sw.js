const CACHE = 'quiver-v1';
const SHELL = [
  '/',
  '/index.html',
  '/styles.css',
  '/manifest.json',
  '/js/main.js',
  '/js/data/analytics.js',
  '/js/data/stages.js',
  '/js/data/storage.js',
  '/js/game/dragdrop.js',
  '/js/game/ui.js',
  '/js/game/validator.js',
  '/js/quantum/bloch.js',
  '/js/quantum/engine.js',
  '/js/quantum/gates.js',
  '/assets/logo.jpg',
  '/assets/icon.png',
  '/assets/apple-touch-icon.png',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
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
