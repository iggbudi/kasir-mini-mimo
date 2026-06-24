const CACHE_NAME = 'kasir-mini-v3';
const ASSETS = [
  '/',
  '/index.html',
  '/pemasukan.html',
  '/pengeluaran.html',
  '/kasbon.html',
  '/riwayat.html',
  '/setting.html',
  '/login.html',
  '/css/style.css',
  '/css/login.css',
  '/js/app.js',
  '/js/login.js',
  '/js/pemasukan.js',
  '/js/pengeluaran.js',
  '/js/kasbon.js',
  '/js/riwayat.js',
  '/js/setting.js',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.pathname.startsWith('/api/')) {
    return;
  }

  if (request.method === 'GET') {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        }).catch(() => {
          if (request.destination === 'document') {
            return caches.match('/index.html');
          }
        });
      })
    );
  }
});
