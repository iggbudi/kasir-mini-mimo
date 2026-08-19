const CACHE_NAME = 'kasir-mini-v25';
const ASSETS = [
  '/',
  '/index.html',
  '/pemasukan.html',
  '/pengeluaran.html',
  '/kasbon.html',
  '/riwayat.html',
  '/setting.html',
  '/barang.html',
  '/salesman.html',
  '/kulakan.html',
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
  '/js/barang.js',
  '/js/salesman.js',
  '/js/kulakan.js',
  '/js/page-init.js',
  '/js/home.js',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch((err) => {
        console.warn('Sebagian aset gagal di-precache:', err);
      });
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
    const isNavigation = request.mode === 'navigate' || request.destination === 'document';
    const isSWFile = url.pathname.endsWith('/sw.js');
    const isAsset = url.pathname.startsWith('/css/')
      || url.pathname.startsWith('/js/')
      || url.pathname === '/manifest.json'
      || /\.(?:ico|png|jpe?g|gif|webp|svg)$/i.test(url.pathname);

    // sw.js harus SELALU diambil dari network agar browser bisa mendeteksi
    // versi baru dan membersihkan cache lama. Kalau tidak, cache lama akan
    // mengabadi dan update tidak pernah jalan.
    if (isSWFile) {
      event.respondWith(fetch(request));
      return;
    }

    // Navigasi (halaman HTML): network-first dengan fallback ke cache saat
    // offline. Setelah deploy, pengguna langsung dapat HTML baru.
    if (isNavigation) {
      event.respondWith(
        fetch(request).then((networkResponse) => {
          // Hanya cache respons sukses. Redirect (mis. /logout → /login.html)
          // dan error TIDAK boleh masuk cache; cache.put response redirect
          // justru melempar dan bisa membatalkan navigasi.
          if (networkResponse && networkResponse.ok) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache).catch(() => {});
            }).catch(() => {});
          }
          return networkResponse;
        }).catch(() => {
          return caches.match(request).then((cached) => {
            return cached || caches.match('/index.html');
          });
        })
      );
      return;
    }

    // Aset statis lain: cache-first dengan fallback network (aman karena
    // cache version dibump saat aset berubah, dan HTML baru memuat nama file
    // yang sama tetapi cache lama sudah dibersihkan oleh SW baru).
    if (isAsset) {
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
      return;
    }
  }
});
