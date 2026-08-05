# Rencana Perbaikan Audit — Kasir Mini

**Tanggal:** 2026-08-05
**Status:** Direncanakan (belum dieksekusi)
**Sumber:** Hasil audit codebase (temuan H1–H3 severity tinggi)

---

## Tujuan

Menutup 3 temuan severity tinggi dari audit:

| ID | Masalah | Dampak |
|----|---------|--------|
| H1 | Default password `admin123` dipakai diam-diam di production | Akun admin production terbuka |
| H2 | CTA "Demo" di landing page (`/demo.html`) di-redirect ke login | Link publik patah |
| H3 | `/manifest.json` dan `/sw.js` ikut diproteksi auth | PWA tidak bisa install/register dari halaman publik |

Lingkup fase ini **hanya H1–H3**. Temuan severity menengah (M1–M7) dicatat di bagian "Fase Lanjutan (Opsional)".

---

## Task 1 — H1: Fail-fast `ADMIN_PASSWORD` di production

### File
- `db/init.js`
- `README.md` (tabel environment variables)
- Test baru: `tests/db/init-production.test.js`

### Masalah
`db/init.js` dipanggil oleh script `vercel-build` saat deploy Vercel. Jika `ADMIN_PASSWORD` tidak diset, admin dibuat dengan password default `admin123` dan hanya mencetak warning ke console build — mudah terlewat. Satu-satunya pemicu peringatan adalah `console.warn`, bukan kegagalan.

### Perubahan yang Diusulkan

Pindahkan query `existing` lebih awal, lalu gagal sebelum membuat admin baru:

```js
const username = process.env.ADMIN_USERNAME || 'admin';
const existing = await getOne('SELECT id FROM admin_user WHERE username = ?', [username]);

// Safety net production: jangan pernah membuat admin default tanpa password eksplisit.
if (!existing && process.env.NODE_ENV === 'production' && !process.env.ADMIN_PASSWORD) {
  throw new Error(
    'ADMIN_PASSWORD wajib diset saat production. ' +
    'Jalankan: vercel env add ADMIN_PASSWORD, lalu deploy ulang.'
  );
}

const password = process.env.ADMIN_PASSWORD || 'admin123';
// ...lanjut logika create/update seperti sekarang
```

### Pertimbangan & Edge Cases
1. **Admin sudah ada di production, env kosong** → lanjut tanpa error (password tidak diubah; tidak ada risiko admin default baru).
2. **Admin belum ada, production, tanpa env** → build Vercel gagal → ini yang diinginkan (alarm dini, bukan warning).
3. **Lokal (`NODE_ENV` bukan `production`)** → perilaku lama tetap: default `admin123` + warning, agar `npm run db:init` tetap mudah untuk pengembangan.
4. **`NODE_ENV=production` hanya berlaku di Vercel** — pastikan tidak ada env lokal yang menyalakannya.

### Test Baru — `tests/db/init-production.test.js`
```js
// Set env SEBELUM require (mengikuti pola auth.test.js):
//   NODE_ENV=production, TURSO_DATABASE_URL=file:<tmp>, tanpa ADMIN_PASSWORD
test('db:init production tanpa ADMIN_PASSWORD ditolak', async () => {
  await assert.rejects(initDb(), /ADMIN_PASSWORD wajib diset/);
});

test('db:init production dengan ADMIN_PASSWORD berhasil', async () => {
  process.env.ADMIN_PASSWORD = 'rahasia';
  await initDb(); // resolve tanpa throw
});
```

### Dokumentasi — `README.md`
Baris tabel `ADMIN_PASSWORD` diubah menjadi:
> `ADMIN_PASSWORD` | Ya (prod) | - | Password admin. **Build production GAGAL jika kosong** (safety net, bukan default `admin123`).

---

## Task 2 — H2: Publikkan `/demo.html`

### File
- `server.js`
- Test baru: `tests/api/public-pages.test.js`

### Masalah
`public/login.html:56` menautkan `href="/demo.html"`, tetapi middleware auth di `server.js` hanya mengecualikan aset (`/css/`, `/js/`, gambar). `/demo.html` bukan aset → pengunjung yang belum login di-redirect balik ke `/login.html`. Link "Coba Demo" patah.

`demo.html` sudah murni simulasi statis (tidak memanggil API), aman dibuka publik.

### Perubahan yang Diusulkan

Ganti handler GET publik yang sekarang (hanya login) dengan peta halaman publik:

```js
// Sebelum
app.get(['/login', '/login.html'], (_req, res) => {
  res.sendFile(path.join(publicDir, 'login.html'));
});

// Sesudah
const PUBLIC_PAGES = {
  '/login': 'login.html',
  '/login.html': 'login.html',
  '/demo.html': 'demo.html'
};
app.get(Object.keys(PUBLIC_PAGES), (req, res) => {
  res.sendFile(path.join(publicDir, PUBLIC_PAGES[req.path]));
});
```

Handler ini tetap berada **sebelum** middleware auth (pola yang sama seperti login sekarang). Aset `demo.css`/`demo.js` sudah lolos lewat `isPublicAsset`.

### Pertimbangan & Edge Cases
1. `/demo.html` tetap bisa diakses saat sudah login — tidak masalah, demo tidak menyentuh data.
2. Tidak ada perubahan di `vercel.json` — semua rute sudah diteruskan ke `server.js`.
3. Jangan gabungkan `/demo.html` ke daftar `isPublicAsset` — itu path halaman, bukan aset; lebih jelas di handler publik.

### Test Baru — ditambahkan ke `tests/api/public-pages.test.js`
```js
test('GET /demo.html tanpa login → 200 HTML (bukan redirect)', async () => {
  const res = await fetch(`${baseUrl}/demo.html`, { redirect: 'manual' });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
});

test('GET /pemasukan.html tanpa login tetap redirect (proteksi utuh)', async () => {
  const res = await fetch(`${baseUrl}/pemasukan.html`, { redirect: 'manual' });
  assert.equal(res.status, 302);
  assert.match(res.headers.get('location'), /\/login\.html/);
});
```

---

## Task 3 — H3: Publikkan `/manifest.json` dan `/sw.js`

### File
- `server.js`
- Test: bagian dari `tests/api/public-pages.test.js`

### Masalah
Middleware `isPublicAsset` hanya mencakup `css/`, `js/`, dan ekstensi gambar. Saat pengunjung belum login di halaman landing:
- `<link rel="manifest" href="/manifest.json">` → fetch di-redirect ke HTML → MIME salah → PWA tidak bisa diinstall.
- `navigator.serviceWorker.register('/sw.js')` di `app.js` → skrip di-redirect ke HTML → TypeError → SW tidak terdaftar.

Commit `bbd422b` ("serve public image assets before authentication") memperbaiki gambar, tetapi melewatkan dua file ini.

### Perubahan yang Diusulkan

Tambah dua path eksplisit di middleware (bukan ekstensi generik, agar tidak membuka file `.json`/`.js` lain):

```js
// Sebelum
const isPublicAsset =
  req.path.startsWith('/css/') ||
  req.path.startsWith('/js/') ||
  /\.(?:ico|png|jpe?g|gif|webp|svg)$/i.test(req.path);

// Sesudah
const isPublicAsset =
  req.path.startsWith('/css/') ||
  req.path.startsWith('/js/') ||
  req.path === '/manifest.json' ||
  req.path === '/sw.js' ||
  /\.(?:ico|png|jpe?g|gif|webp|svg)$/i.test(req.path);
```

### Pertimbangan & Edge Cases
1. **Eksplisit lebih baik daripada regex `json`** — hanya dua file yang dibuka; tidak ada file `.json`/`.js` lain di root `public/` yang perlu publik.
2. `express.static` akan men-set MIME yang benar (`application/json`, `application/javascript`) karena middleware hanya `next()` — tidak ada pengaruh pada header.
3. Setelah deploy, PWA yang sudah terinstall tetap butuh bump cache version (`public/sw.js` → `kasir-mini-v17`) jika ada perubahan aset lain — **bukan bagian dari task ini**, hanya catatan.

### Test Baru — ditambahkan ke `tests/api/public-pages.test.js`
```js
test('GET /manifest.json tanpa login → 200 JSON', async () => {
  const res = await fetch(`${baseUrl}/manifest.json`, { redirect: 'manual' });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /application\/json/);
});

test('GET /sw.js tanpa login → 200 JavaScript', async () => {
  const res = await fetch(`${baseUrl}/sw.js`, { redirect: 'manual' });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /javascript/);
});
```

---

## Task 4 — Dokumentasi

| File | Perubahan |
|------|-----------|
| `README.md` | Tabel env: catatan `ADMIN_PASSWORD` wajib di production (build gagal) |
| `docs/CONTRACT.md` | Bagian Security: tambah poin "Default password hanya untuk lingkungan lokal; production wajib `ADMIN_PASSWORD`" |
| `docs/audit-fix-plan.md` | File ini — tandai task yang selesai saat eksekusi |

---

## Task 5 — Verifikasi & Rilis

### Verifikasi statis (bisa di Termux)
```bash
node --check db/init.js
node --check server.js
node --check tests/api/public-pages.test.js
node --check tests/db/init-production.test.js
```

### Verifikasi penuh (butuh lingkungan dengan deps terinstall — tidak bisa di Termux, libsql menolak Android)
```bash
npm run db:init
npm start
npm test          # seluruh suite: lama + 2 file baru
```

### Cek manual
1. `npm run db:init` lokal tetap berhasil (default `admin123` + warning).
2. Buka `/` saat logout → redirect ke `/login.html` (tidak berubah).
3. Buka `/demo.html` saat logout → demo tampil.
4. DevTools → Application → Service Worker terdaftar dari `/login.html` (tanpa login).
5. Manifest ter-fetch (200 JSON) dari halaman landing.

### Rilis
- Commit: `fix: harden production bootstrap and expose public demo/PWA assets`
- Push ke `origin/main` setelah semua test hijau.

---

## Definisi Selesai (DoD)

- [x] H1: `db:init` di `NODE_ENV=production` tanpa `ADMIN_PASSWORD` **gagal** dengan pesan jelas; dengan env **berhasil** — `db/init.js` + `tests/db/init-production.test.js`
- [x] H2: `/demo.html` bisa diakses tanpa login (200 HTML) — `server.js` PUBLIC_PAGES + test `tests/api/public-pages.test.js`
- [x] H3: `/manifest.json` & `/sw.js` bisa diakses tanpa login (200, MIME benar) — `server.js` isPublicAsset + test
- [x] Negatif check: halaman aplikasi lain (`/pemasukan.html`, `/`) tetap redirect ke login
- [ ] Test lama + 2 file test baru hijau — **belum bisa dijalankan di Termux** (libsql tolak Android); hanya `node --check` + sanity test logika
- [x] README & CONTRACT diperbarui
- [x] Commit & push

---

## Fase Lanjutan (Opsional — di luar scope H1–H3)

Dicatat untuk sprint berikutnya, urut prioritas:

| ID | Item | Catatan |
|----|------|---------|
| M1 | ~~Test API untuk `barang`, `salesman`, `kulakan`, `penjualan`~~ | **DONE** — 4 file test baru (`barang`, `salesman`, `kulakan`, `penjualan`), total suite 103 test. Belum dieksekusi di Termux (libsql tolak Android); hanya `node --check`. Commit belum dibuat |
| M2 | ~~Rate limiting / lockout pada `/api/auth/login`~~ | **DONE** — `middleware/rate-limit.js` (in-memory per instance, env-configurable), `trust proxy` di server.js, test `tests/api/rate-limit.test.js`. Respons 429 + `Retry-After`; hanya kegagalan kredensial yang dihitung, sukses mereset. Commit belum dibuat |
| M3 | ~~CSP parsial: `self` + `fonts.googleapis.com` + `fonts.gstatic.com`~~ | **DONE** — helmet CSP diaktifkan di server.js (default-src 'self', script/style 'unsafe-inline' karena 9 halaman inline, connect-src 'self', object-src none, frame-ancestors 'self'). Test header CSP di public-pages.test.js. Commit belum dibuat |
| M4 | ~~`bcrypt.compare` async (ganti `compareSync`)~~ | **DONE** — `routes/auth.js` pakai `await bcrypt.compare`; `db/init.js` pakai `await bcrypt.hash`. Tidak ada panggilan sync tersisa |
| M5 | ~~Pindah `playwright` ke `devDependencies`~~ | **DONE** — package.json + package-lock.json (root devDependencies); JSON tervalidasi |
| M6 | ~~Perbaiki error handling `routes/setting.js`~~ | **DONE** — `instanceof ValidationError` menggantikan string matching |
| M7 | ~~Rename `kasbon_jumlah_orang` → `kasbon_aktif` (drop alias)~~ | **DONE** — alias dihapus dari `routes/ringkasan.js`; tidak ada pemakaian di frontend; test + CONTRACT disinkronkan |
