# Sprint 2 Plan — Foundation Kasir

**Status:** In Progress  
**Gate Target:** G3 — Foundation Kasir Ready  
**Based on:** `sprint.md` + `prd2.md`

## Tujuan

Menyiapkan pondasi untuk fitur kasir setelah auth selesai (Sprint 1). Fokus pada infrastruktur database, validasi, route struktur, dan API setting dasar. Dashboard minimal sudah bisa membaca data dari setting.

**Gate Criteria (dari sprint.md):**
- Foundation kasir siap
- Server jalan
- DB init sukses
- Health check OK
- Setting API berfungsi dan terproteksi

## Scope

### In Scope
- Finalisasi schema transaksi lengkap:
  - `pemasukan`
  - `pengeluaran`
  - `kasbon`
  - `kasbon_bayar`
  - Update `setting` (sudah ada)
- Helper validasi umum di `utils/validate.js`
- Route folder structure yang scalable
- `routes/setting.js`:
  - `GET /api/setting`
  - `PUT /api/setting`
- Proteksi semua API kasir menggunakan `requireAuth`
- Update server untuk mounting route yang benar
- Dashboard minimal (`public/index.html`) bisa membaca `nama_warung` dari setting
- Test untuk setting API
- Update `db/init.js` dan verifikasi

### Out of Scope (Sprint 3+)
- API pemasukan / pengeluaran / kasbon lengkap (CRUD)
- Halaman transaksi (`pemasukan.html`, dll.)
- Ringkasan, riwayat, backup
- Bottom tab navigation penuh
- PWA

## Deliverables

| Artefak                  | Status | Catatan |
|--------------------------|--------|---------|
| `db/init.js`             |        | Schema transaksi + seed |
| `utils/validate.js`      |        | Helper validasi |
| `routes/setting.js`      |        | GET + PUT |
| `server.js`              |        | Mounting + struktur |
| `public/index.html`      |        | Tampilkan nama warung |
| `public/js/app.js`       |        | (opsional) helper tambahan |
| `tests/api/setting.test.js` |   | Test lengkap |
| `docs/sprint2-plan.md`   |        | Dokumentasi ini |

## Rincian Tugas

### 1. Database Schema (db/init.js)
- Tambahkan tabel menggunakan `CREATE TABLE IF NOT EXISTS`
- Ikuti spec dari `prd2.md` §9:
  - `pemasukan`: id, barang, quantity (>=1), harga (>0), total (GENERATED), catatan, tanggal
  - `pengeluaran`: id, keterangan, nominal (>0), catatan, tanggal
  - `kasbon`: id, nama, nominal (>0), sisa (>=0), keterangan, status (`belum_lunas`|`lunas`), tanggal
  - `kasbon_bayar`: id, kasbon_id (FK), bayar (>0), tanggal
- Pertahankan `setting` + seed default (`nama_warung`, `timezone`)
- Tambahkan index yang berguna jika diperlukan (tanggal)
- Jalankan `npm run db:init` harus tetap aman dan idempotent

### 2. Validasi Helper (utils/validate.js)
Fungsi umum (error message dalam Bahasa Indonesia):

- `requireString(value, fieldName)` → return string trimmed atau throw Error
- `requirePositiveInt(value, fieldName)`
- `optionalString(value)`
- Gunakan di route layer

### 3. Setting API (routes/setting.js)
- Mount di `/api/setting` dengan `requireAuth`
- **GET**:
  - Ambil dari table `setting`
  - Response: `{ nama_warung, timezone }`
- **PUT**:
  - Body: `{ nama_warung: "..." }`
  - Validasi: nama_warung wajib dan minimal 1 karakter
  - Update DB
  - Return data terbaru
- Gunakan `success()` / `fail()` dari `utils/response.js`
- Semua error pakai pesan Bahasa Indonesia

### 4. Server & Route Structure (server.js)
Perubahan:
- Import dan mount:
  ```js
  const settingRoutes = require('./routes/setting');
  app.use('/api/setting', requireAuth, settingRoutes);
  ```
- Letakkan setelah `/api/auth`
- Sebelum catch-all `/api`
- Tambahkan komentar untuk route masa depan (pemasukan, dll.)
- Pastikan `attachUser` tetap global

### 5. Frontend — Dashboard Minimal
- `public/index.html`:
  - Fetch `/api/setting` setelah login
  - Tampilkan nama warung di header
  - Ganti placeholder teks menjadi lebih bermakna
- Gunakan `window.KasirApp.apiFetch` dan `formatRupiah` jika relevan
- Tetap sederhana (Sprint 2 bukan UI lengkap)

### 6. Testing
- Buat `tests/api/setting.test.js` mengikuti pola `auth.test.js`
- Test case:
  - GET setting (auth required)
  - PUT berhasil mengubah nama warung
  - PUT nama kosong / tidak valid → 400
  - Akses tanpa login → 401
  - Health check tetap OK
- Jalankan dengan `npm test`

### 7. Verifikasi Akhir
- `npm run db:init`
- `npm start`
- `curl` atau browser:
  - `GET /api/health`
  - Login → `GET /api/setting`
  - `PUT /api/setting`
- `npm test`
- Pastikan tidak ada error dan DB tetap bersih

## API Contract — Setting (Ringkas)

**GET /api/setting**
```json
{
  "success": true,
  "data": {
    "nama_warung": "Warung Saya",
    "timezone": "Asia/Jakarta"
  },
  "message": null
}
```

**PUT /api/setting**
Body:
```json
{ "nama_warung": "Toko Berkah" }
```

Response sama seperti GET dengan data terbaru.

Error:
- 400: `Nama warung wajib diisi`
- 401: Belum login (via middleware)

## Urutan Implementasi yang Disarankan

1. Update `db/init.js` + verifikasi
2. Buat `utils/validate.js`
3. Buat `routes/setting.js`
4. Update `server.js`
5. Update frontend (`public/index.html` + app.js)
6. Buat `tests/api/setting.test.js`
7. Verifikasi lengkap + dokumentasi

## Catatan & Risiko

- Gunakan `better-sqlite3` synchronous style (seperti auth)
- Semua response harus ikuti format `{ success, data, message }`
- Pesan error dalam Bahasa Indonesia
- Hindari scope creep ke transaksi penuh
- Setelah sprint ini, siap untuk Sprint 3 (Transaksi Inti)

## Progress Tracking

Lihat todo di sesi kerja atau `sprint.md` untuk status gate.

---

**Dibuat:** Berdasarkan diskusi dan analisis `sprint.md` + codebase saat ini (Juni 2026).
