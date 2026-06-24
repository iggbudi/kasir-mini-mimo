# Rencana Sprint — Kasir Mini

## Keputusan Scope Auth

Login ditambahkan sebagai revisi scope MVP:

- Login single admin, bukan multi-user/role.
- Username default: `admin`.
- Password default: `admin123`.
- Password bisa dioverride via environment variable `ADMIN_PASSWORD` saat inisialisasi DB.
- Session berlaku 12 jam.
- `/login.html` publik, semua halaman aplikasi lain wajib login.

---

## Sprint 0 — Contract & Security Design

**Tujuan:** Membekukan kontrak teknis sebelum development.

**Output:**

- `docs/CONTRACT.md`
- Kontrak API auth:
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
  - `GET /api/auth/me`
- Kontrak health check:
  - `GET /api/health`
- Aturan session, cookie, validasi, dan response standar.

**Gate:** G1 Contract Ready.

---

## Sprint 1 — MVP Login Aman

**Tujuan:** Aplikasi bisa login dengan benar dan aman sebelum fitur kasir dibuat.

### Backend

- Setup project dasar:
  - `package.json`
  - scripts `start`, `dev`, `test`, `db:init`
- Setup database SQLite.
- Schema auth:
  - `admin_user`
  - `auth_session`
  - `setting`
- Seed admin default.
- Express server.
- Security middleware:
  - `helmet`
  - limit body JSON
  - cookie parser
  - error handler tanpa expose stack trace
- Auth route:
  - login
  - logout
  - me
- Auth middleware untuk proteksi API/private pages.

### Frontend

- `public/login.html`
- `public/js/login.js`
- `public/js/app.js`
- `public/css/style.css`
- Placeholder dashboard `public/index.html`
- Redirect otomatis ke login jika belum login.
- Logout dari dashboard.

### Testing

- Test login tanpa username.
- Test login tanpa password.
- Test password salah.
- Test login benar mendapat cookie.
- Test `/api/auth/me` tanpa cookie.
- Test `/api/auth/me` dengan cookie.
- Test logout invalidasi session.
- Test API protected tanpa login.

### Security Checklist

- [x] Password tidak plaintext di DB.
- [x] Password di-hash dengan bcrypt.
- [x] Cookie session `HttpOnly`.
- [x] Cookie session `SameSite=Lax`.
- [x] Cookie session `Secure` saat production.
- [x] Session punya expiry 12 jam.
- [x] Session token random.
- [x] Session di DB disimpan sebagai hash token.
- [x] Logout menghapus session server-side.
- [x] Error login salah generik.
- [x] JSON body dibatasi.
- [x] Stack trace tidak dikirim ke client.

**Gate:** G2 Auth Foundation Ready.

**Status:** Selesai.

---

## Sprint 2 — Foundation Kasir

**Tujuan:** Menyiapkan pondasi fitur kasir setelah auth selesai.

### Tasks

- Finalisasi schema transaksi:
  - `pemasukan`
  - `pengeluaran`
  - `kasbon`
  - `kasbon_bayar`
  - `setting`
- Pastikan semua API kasir wajib melewati auth middleware.
- Setup route folder final.
- Tambah helper validasi umum:
  - string wajib
  - integer positif
  - panjang maksimal field
  - validasi tanggal query
- Tambah setting API dasar:
  - `GET /api/setting`
  - `PUT /api/setting`
- Dashboard masih minimal, tapi sudah bisa membaca setting nama warung.

### Output

- Update `db/init.js`
- Update `server.js`
- `routes/setting.js`
- helper validasi jika diperlukan
- test setting API

**Gate:** Foundation kasir siap, server jalan, DB init sukses, health check OK.

---

## Sprint 3 — Transaksi Inti

**Tujuan:** Membuat fitur kasir utama.

### Backend

- API pemasukan:
  - `GET /api/pemasukan?dari=&sampai=`
  - `POST /api/pemasukan`
  - `DELETE /api/pemasukan/:id`
- API pengeluaran:
  - `GET /api/pengeluaran?dari=&sampai=`
  - `POST /api/pengeluaran`
  - `DELETE /api/pengeluaran/:id`
- API kasbon:
  - `GET /api/kasbon?status=`
  - `POST /api/kasbon`
  - `POST /api/kasbon/:id/bayar`
  - `DELETE /api/kasbon/:id`

### Frontend

- Halaman pemasukan.
- Halaman pengeluaran.
- Halaman kasbon.
- Shared helper:
  - format rupiah
  - fetch wrapper
  - toast
  - confirm dialog
  - loading/error/empty state

### Testing

- Test validasi field wajib.
- Test angka harus positif.
- Test ID tidak ditemukan = 404.
- Test bayar kasbon tidak boleh lebih dari sisa.
- Test kasbon lunas saat pembayaran sama dengan sisa.

**Gate:** API transaksi dan UI transaksi utama lolos test.

---

## Sprint 4 — Dashboard, Riwayat, Setting, Backup

**Tujuan:** Melengkapi alur penggunaan harian warung.

### Backend

- API ringkasan:
  - `GET /api/ringkasan`
- API riwayat:
  - `GET /api/riwayat?dari=&sampai=`
- API backup:
  - `GET /api/backup`

### Frontend

- Dashboard lengkap:
  - nama warung
  - tanggal
  - pemasukan hari ini
  - pengeluaran hari ini
  - sisa kas
  - kasbon outstanding
- Halaman riwayat.
- Halaman pengaturan:
  - ubah nama warung
  - backup database
- Bottom tab bar 5 item:
  - Beranda
  - Masuk
  - Keluar
  - Kasbon
  - Atur

### Testing

- Test ringkasan menghitung benar.
- Test riwayat menampilkan semua tipe transaksi.
- Test backup download file `.db`.
- Test setting nama kosong ditolak.

**Gate:** UI complete dan API complete.

---

## Sprint 5 — PWA, QA, Release

**Tujuan:** Membuat aplikasi siap dipakai di HP low-end dan bisa di-install.

### PWA

- `public/manifest.json`
- `public/sw.js`
- Cache-first untuk aset statis.
- Offline graceful:
  - UI tetap navigable.
  - Form tidak submit.
  - Toast: `Tidak ada koneksi`.

### QA

- API test lengkap.
- UI checklist viewport 375px.
- E2E flow:
  1. Set nama warung.
  2. Tambah pemasukan.
  3. Cek dashboard.
  4. Tambah pengeluaran.
  5. Cek sisa kas.
  6. Tambah kasbon.
  7. Bayar partial.
  8. Bayar lunas.
  9. Cek riwayat.
  10. Backup DB.
- PWA test:
  - manifest valid
  - service worker register
  - offline toast muncul

### Release

- README.
- Cleanup.
- Final smoke test:
  - `npm run db:init`
  - `npm start`
  - `npm test`

**Gate:** Ship Ready.

---

## Sprint 6 — Turso Database Migration

**Tujuan:** Mengganti SQLite lokal (better-sqlite3) dengan Turso (libSQL) agar database persisten dan cocok untuk serverless.

### Backend

- Daftar & setup Turso database
- Ganti dependency `better-sqlite3` → `@libsql/client`
- Refactor `db/connection.js` (async client)
- Buat helper query `db/query.js` (execute, getOne, getAll)
- Update `db/init.js` menjadi async migration
- Update `middleware/auth.js` (semua fungsi session jadi async)
- Update `server.js` health check

### Testing

- Test koneksi Turso lokal
- Pastikan init script jalan
- Test auth flow dengan DB baru

**Gate:** G7 — Turso Migration Ready

---

## Sprint 7 — Async Routes & API

**Tujuan:** Mengubah semua query database menjadi async agar kompatibel dengan Turso client.

### Backend

- Update semua routes:
  - `routes/auth.js`
  - `routes/setting.js`
  - `routes/pemasukan.js`
  - `routes/pengeluaran.js`
  - `routes/kasbon.js`
  - `routes/ringkasan.js`
  - `routes/riwayat.js`
  - `routes/backup.js`
- Update transaksi logic (kasbon bayar) menggunakan `batch()`
- Update `server.js` route mounting jika perlu
- Pastikan error handling tetap Bahasa Indonesia

### Testing

- Update semua test di `tests/api/`
- Test semua endpoint dengan Turso
- Test transaksi atomic

**Gate:** G8 — Async API Ready

---

## Sprint 8 — Vercel Deployment

**Tujuan:** Deploy aplikasi ke Vercel dengan konfigurasi serverless yang benar.

### Deployment

- Adaptasi `server.js` untuk serverless (export app, conditional listen)
- Buat `vercel.json`
- Setup environment variables (TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, dll)
- Update `package.json` scripts (vercel-build)
- Adaptasi `/api/backup` (gunakan Turso API atau export)
- Update README dengan cara deploy & setup Turso

### QA

- Deploy ke Vercel
- Test E2E flow lengkap di production
- Test PWA di deployed URL
- Test offline behavior
- Verify cold start & DB connection

**Gate:** G9 — Production Deployed

---

## Urutan Gate

| Gate | Nama | Syarat Lolos |
|---|---|---|
| G1 | Contract Ready | Contract auth dan API dasar jelas |
| G2 | Auth Foundation Ready | Login aman jalan dan test hijau |
| G3 | Foundation Kasir Ready | DB transaksi dan server siap |
| G4 | Transaksi Core Ready | Pemasukan, pengeluaran, kasbon jalan |
| G5 | App Complete | Dashboard, riwayat, setting, backup selesai |
| G6 | Ship Ready | PWA, QA, README, semua test lolos |
| G7 | Turso Migration Ready | Database pindah ke Turso, init & auth jalan |
| G8 | Async API Ready | Semua route pakai async query, test hijau |
| G9 | Production Deployed | Berhasil deploy ke Vercel + E2E production |
