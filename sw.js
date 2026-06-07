const CACHE = 'quiver-v4';
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
  `${BASE}/js/data/sync.js`,
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
  e.waitUntil(
    caches.open(CACHE).then(c =>
      Promise.allSettled(SHELL.map(url => c.add(url)))
    )
  );
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
  const url = e.request.url;
  // Never cache Supabase API calls or the Supabase SDK from CDN
  if (url.includes('supabase.co') || url.includes('supabase.js')) {
    e.respondWith(fetch(e.request));
    return;
  }
  e.respondWith(
    fetch(e.request)
      .then(response => {
        const clone = response.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});
