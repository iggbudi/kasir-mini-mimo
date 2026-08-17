# AGENTS.md — Panduan Kerja untuk Agen / Developer

Panduan ini berisi konvensi dan mekanisme penting yang harus dipahami sebelum
mengubah kode Kasir Mini. Bacalah terutama saat menyentuh `public/`, PWA,
atau melakukan deploy.

## Ringkasan Proyek

- Aplikasi kasir web (warung kecil): Express + @libsql/client (Turso/SQLite),
  frontend vanilla HTML/CSS/JS tanpa framework, di-deploy ke Vercel
  (auto-deploy dari push ke GitHub `main`).
- Struktur utama: `server.js`, `routes/`, `db/`, `utils/`, `public/`,
  `tests/` (node:test). Detail arsitektur: `README.md`, `docs/CONTRACT.md`.

## ⚠️ Mekanisme Cache Bump PWA (WAJIB)

Aplikasi ini adalah PWA dengan service worker (`public/sw.js`) yang
men-cache aset statis. **Tanpa bump versi cache, pengguna tidak akan pernah
mendapat aset baru setelah deploy** (browser menyajikan versi lama dari cache).

**Aturan emas: setiap kali mengubah aset di `public/` (HTML, CSS, JS, gambar,
manifest), naikkan `CACHE_NAME` di `public/sw.js`:**

```js
// public/sw.js
const CACHE_NAME = 'kasir-mini-v20'; // ← naikkan saat aset berubah
```

Contoh: `kasir-mini-v20` → `kasir-mini-v21`.

### Mengapa ini penting

- Service worker meng-cache aset dengan nama cache ber-versioning. Versi baru
  membuat cache lama dihapus pada `activate`, sehingga pengguna otomatis
  mendapat aset baru.
- Jangan pernah mengubah aset `public/` tanpa bump — perubahan tidak akan
  terlihat di perangkat pengguna yang sudah membuka aplikasi.

### Update otomatis setelah deploy

Mekanisme berikut sudah diterapkan agar pengguna tidak perlu clear cache
manual:

1. `public/sw.js` memakai strategi **network-first untuk navigasi/HTML** dan
   `sw.js` selalu di-fetch dari network — versi baru terdeteksi saat pengguna
   membuka aplikasi.
2. `public/js/app.js` mendaftarkan SW dengan `updateViaCache: 'none'` dan
   melakukan auto-reload saat SW baru aktif (`controllerchange`).
3. `server.js` mengirim `/sw.js` dengan `Cache-Control: no-cache, no-store,
   must-revalidate` agar CDN/proxy tidak menahan versi lama.

Bump versi cache tetap wajib dilakukan — mekanisme di atas hanya memastikan
update *sampai* ke pengguna; bump memastikan aset baru *benar-benar dimuat*.

### Checklist saat push/deploy

1. Ubah aset di `public/`? → bump `CACHE_NAME` di `public/sw.js`.
2. Test UI `tests/ui/barang-stock-management.test.js` mengecek versi cache
   (regex `kasir-mini-vNN`) — pastikan test ikut diperbarui agar lulus.
3. Jalankan `npm test` sebelum push.

## ✅ Commit & Push Setiap Selesai Perubahan

- **Setiap kali satu perubahan selesai dan sudah diverifikasi (test lulus,
  syntax check OK), langsung commit lalu push ke `main`.**
- Jangan menumpuk banyak perubahan dalam satu commit — pecah per fitur/
  perbaikan yang logis (mis. backend vs frontend vs dokumentasi).
- Push memicu auto-deploy ke Vercel, jadi pastikan `npm test` lulus sebelum
  push (kegagalan pre-existing yang tidak terkait boleh dilaporkan, bukan
  diperbaiki di luar cakupan).
- Commit memakai pesan yang ringkas dan jelas, diawali jenis perubahan
  (`feat:`, `fix:`, `docs:`, `chore:`).

## 🐛 Alur Bugfix (WAJIB)

Saat menangani bug, ikuti urutan ini:

1. **Cek kondisi dulu** — reproduksi/pahami gejala, baca kode terkait,
   identifikasi akar masalah sebelum mengubah apa pun.
2. **Buat perencanaan** — tulis langkah perbaikan (boleh di todo list);
   jangan langsung menebak-nebak.
3. **Kerjakan** — implementasikan perbaikan sesuai rencana, sekecil dan
   seterfokus mungkin.
4. **Local test** — jalankan test yang relevan (`node --test` atau
   `npm test`) + syntax check; pastikan tidak ada regresi.
5. **Update docs** — perbarui dokumentasi yang terdampak (README,
   CONTRACT, panduan, AGENTS.md) bila perilaku/kontrak berubah.
6. **Commit dan push** — commit dengan pesan `fix: ...` lalu push ke
   `main`.

## Konvensi Lain

- Semua pesan error API dan UI dalam Bahasa Indonesia.
- Perubahan stok selalu lewat `utils/stock.js`
  (`updateStockWithMutation`) dalam write-transaction yang sama — jangan
  pernah `UPDATE master_barang SET stok` langsung dari route lain.
- Migration baru: tambahkan entri di `db/migrations.js`, lalu perbarui
  `db/restore.js` dan `routes/backup.js` agar backup/restore tetap
  kompatibel (lihat riwayat v8/v9).
- Frontend: jangan tambah framework; ikuti pola `public/js/*.js` yang ada.
- Test: `node --test tests/**/*.test.js` (atau `npm test`).
