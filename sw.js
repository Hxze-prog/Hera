const CACHE = 'hera-shell-v16';

const SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/mobile_bg.png',
  '/website_bg.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/css/styles.css',
  '/js/app.js',
  '/js/data.js',
  '/js/media.js',
  '/js/state.js',
  '/js/admin.js',
  '/js/views/envelopes.js',
  '/js/views/memories.js',
  '/js/views/vouchers.js',
  '/js/views/distance.js',
  '/shared/api.js',
  '/shared/audio.js',
  '/shared/client.js',
  '/shared/config.js',
  '/shared/session.js',
  '/shared/ui.js',
  '/little-things',
  '/little-things/index.html',
  '/little-things/manifest.json',
  '/little-things/assets/icon-192.png',
  '/little-things/assets/mobile_bg.png',
  '/little-things/assets/website_bg.png',
  '/little-things/css/styles.css',
  '/little-things/js/app.js',
  '/little-things/js/questions.js',
  '/surprise',
  '/surprise/index.html',
  '/surprise/manifest.json',
  '/surprise/css/styles.css',
  '/surprise/js/app.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function isNetworkOnlyPath(path) {
  return path.startsWith('/api/') || path.startsWith('/auth/') || path.startsWith('/rest/') || path.startsWith('/storage/') || path.startsWith('/audio/');
}

async function networkOnly(request) {
  return fetch(request);
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

function fallbackFor(path) {
  if (path.startsWith('/little-things')) return '/little-things/index.html';
  if (path.startsWith('/surprise')) return '/surprise/index.html';
  return '/index.html';
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isNetworkOnlyPath(url.pathname)) {
    event.respondWith(networkOnly(request));
    return;
  }
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(fallbackFor(url.pathname))));
    return;
  }
  event.respondWith(cacheFirst(request));
});
