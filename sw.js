const CACHE = 'for-you-shell-v11';

const SHELL = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/manifest.json',
  '/mobile_bg.png',
  '/website_bg.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/js/app.js',
  '/js/api.js',
  '/js/client.js',
  '/js/config.js',
  '/js/data.js',
  '/js/media.js',
  '/js/session.js',
  '/js/state.js',
  '/js/ui.js',
  '/js/admin.js',
  '/js/views/envelopes.js',
  '/js/views/memories.js',
  '/js/views/vouchers.js',
  '/js/views/distance.js'
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

function isPrivatePath(path) {
  return path.startsWith('/api/') || path.startsWith('/auth/') || path.startsWith('/rest/') || path.startsWith('/storage/');
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

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isPrivatePath(url.pathname)) {
    event.respondWith(networkOnly(request));
    return;
  }
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    );
    return;
  }
  event.respondWith(cacheFirst(request));
});
