# Sprint 4 Plan — Dashboard, Riwayat, Setting, Backup

**Status:** Planning  
**Gate Target:** UI complete dan API complete (G5)  
**Based on:** `sprint.md` (Sprint 4) + `prd2.md`

## Tujuan

Melengkapi alur penggunaan harian warung dengan dashboard ringkasan, riwayat transaksi, halaman pengaturan, dan fitur backup.

Setelah sprint ini:
- Beranda menampilkan ringkasan hari ini secara akurat
- Bisa melihat semua riwayat transaksi dengan filter tanggal
- Bisa ubah nama warung
- Bisa backup database (.db file)

## Scope

### In Scope (sesuai sprint.md + prd2)
**Backend:**
- `routes/ringkasan.js` → `GET /api/ringkasan`
  - Agregasi hari ini:
    - nama_warung (dari setting)
    - tanggal (hari ini)
    - pemasukan (sum total hari ini)
    - pengeluaran (sum nominal hari ini)
    - sisa_kas = pemasukan - pengeluaran
    - kasbon_outstanding (sum sisa untuk status belum_lunas)
    - kasbon_jumlah_orang (count kasbon belum_lunas)
- `routes/riwayat.js` → `GET /api/riwayat?dari=&sampai=`
  - Gabungkan semua transaksi (pemasukan, pengeluaran, kasbon create, kasbon_bayar)
  - Format: `{ items: [{ tipe, id, label, nominal, tanggal }] }`
  - Default hari ini
- Tambah backup di `routes/setting.js` atau route terpisah:
  - `GET /api/backup` → download file `kasir-backup-YYYYMMDD.db`
  - Gunakan streaming file dari `db/kasir.db`
- Pastikan semua pakai auth middleware
- Update `server.js` untuk mount ringkasan dan riwayat

**Frontend:**
- Lengkapi `public/index.html` (Beranda) sebagai dashboard lengkap menggunakan `/api/ringkasan`
  - Header: nama warung + tanggal hari ini + sapaan
  - Stats cards: Pemasukan, Pengeluaran, Sisa Kas, Kasbon outstanding + jumlah orang
  - Quick menu cards (sudah ada)
  - Link ke Riwayat
- `public/riwayat.html` + `public/js/riwayat.js`
  - Daftar riwayat gabungan
  - Filter tanggal (hari ini / custom range)
  - Tampilkan tipe dengan icon/label berbeda
  - Pagination sederhana atau load all (karena kecil)
- `public/setting.html` + `public/js/setting.js`
  - Form ubah nama warung (gunakan existing PUT /api/setting)
  - Tombol Backup Database → trigger download `/api/backup`
  - Tampilkan info warung
- Bottom tab bar 5 item di semua halaman:
  - Beranda (`/`)
  - Masuk (`/pemasukan.html`)
  - Keluar (`/pengeluaran.html`)
  - Kasbon (`/kasbon.html`)
  - Atur (`/setting.html`)
- Update `app.js` jika perlu (tambah helper untuk ringkasan/riwayat)
- Update semua halaman untuk memanggil `renderBottomNav` dengan 5 item

**CSS:**
- Perluasan minimal untuk riwayat list (timeline atau grouped)
- Setting form styles (jika belum ada)
- Backup button state

**Testing:**
- Test ringkasan menghitung benar (menggunakan data mock)
- Test riwayat menampilkan semua tipe transaksi
- Test backup mengembalikan file .db valid
- Test setting nama kosong ditolak (sudah ada di S2, pastikan)
- Update existing tests jika perlu

### Out of Scope
- PWA (Sprint 5)
- Riwayat detail per item (klik untuk lihat)
- Export CSV / print
- Advanced filter riwayat (tipe spesifik)
- Multiple setting (timezone edit)

## API Details (dari prd2.md)

### GET `/api/ringkasan`
Response `data`:
```json
{
  "nama_warung": "Warung Sukma",
  "tanggal": "2026-06-24",
  "pemasukan": 1250000,
  "pengeluaran": 350000,
  "sisa_kas": 900000,
  "kasbon_outstanding": 275000,
  "kasbon_jumlah_orang": 3
}
```

Implementasi backend: query sum hari ini + subquery untuk kasbon.

### GET `/api/riwayat?dari=&sampai=`
```json
{
  "success": true,
  "data": {
    "items": [
      { "tipe": "pemasukan", "id": 12, "label": "Beras 5kg", "nominal": 30000, "tanggal": "2026-06-24 10:15:00" },
      { "tipe": "pengeluaran", "id": 5, "label": "Listrik", "nominal": 50000, "tanggal": "..." },
      { "tipe": "kasbon", "id": 3, "label": "Budi", "nominal": 100000, "tanggal": "..." },
      { "tipe": "kasbon_bayar", "id": 7, "label": "Bayar kasbon Budi", "nominal": 40000, "tanggal": "..." }
    ]
  }
}
```

Backend: 4 SELECT + UNION ALL, order by tanggal DESC.

### GET `/api/backup`
- Response: binary file download
- Header: `Content-Disposition: attachment; filename="kasir-backup-20260624.db"`
- Header: `Content-Type: application/octet-stream`

Gunakan `fs.createReadStream` + pipe ke res.

## Struktur File yang Diperlukan

**Baru:**
- `routes/ringkasan.js`
- `routes/riwayat.js`
- `public/riwayat.html`
- `public/js/riwayat.js`
- `public/setting.html`
- `public/js/setting.js`
- `tests/api/ringkasan.test.js`
- `tests/api/riwayat.test.js`
- `tests/api/backup.test.js` (atau di setting)

**Diubah:**
- `server.js` (mount ringkasan + riwayat)
- `routes/setting.js` (tambah backup endpoint)
- `public/index.html` (gunakan ringkasan API + update nav)
- `public/js/app.js` (extend bottom nav ke 5 item + helper lain)
- `public/css/style.css` (jika perlu tambahan untuk riwayat/setting)
- Semua halaman transaksi (panggil renderBottomNav dengan 'atur' atau update pages)

## Rencana Implementasi

1. **Backend dulu**
   - Buat `routes/ringkasan.js` (gunakan helper tanggal dari app logic)
   - Tambah backup endpoint di `routes/setting.js`
   - Buat `routes/riwayat.js` (query UNION, format label bagus)
   - Mount di server.js
   - Buat test untuk ketiganya (mirip pola sebelumnya)

2. **Frontend Dashboard & Nav**
   - Update `renderBottomNav` di app.js untuk include "Atur"
   - Refactor `index.html` untuk fetch `/api/ringkasan` (ganti manual fetch)
   - Tambah tanggal hari ini
   - Pastikan stats cards dan menu tetap bagus

3. **Halaman Riwayat**
   - Buat `riwayat.html` + js
   - Form filter tanggal (dari/sampai) + tombol apply
   - Render list item dengan warna berbeda per tipe (masuk hijau, keluar merah, kasbon biru)
   - Gunakan `formatDateID`, `showLoading`, `showEmpty`

4. **Halaman Setting**
   - Buat `setting.html` + js
   - Load current nama_warung
   - Form edit + save (PUT /api/setting)
   - Tombol besar "Backup Database" → `window.location.href = '/api/backup'`
   - Toast sukses

5. **CSS & Polish**
   - Tambah style untuk riwayat (misal .riwayat-item, .tipe-badge)
   - Responsive untuk setting
   - Pastikan bottom-nav 5 item rapi (mungkin perlu adjust CSS)

6. **Testing & Verifikasi**
   - Tambah unit test API
   - Manual E2E:
     - Dashboard tampilkan angka benar setelah transaksi
     - Riwayat tampilkan semua tipe + filter
     - Ubah nama warung → refresh dashboard
     - Backup download file dan ukuran masuk akal
   - Pastikan semua halaman punya bottom nav 5 item

## Pertimbangan Teknis

- **Ringkasan tanggal:** Selalu hari ini local. Gunakan `getTodayStr()` di frontend atau di backend.
- **Riwayat UNION:** Perlu hati-hati dengan alias kolom. Gunakan `label` yang deskriptif (untuk kasbon_bayar sebut "Pembayaran untuk [nama]" jika memungkinkan, tapi sederhana dulu).
- **Backup:** Jangan cache, tambah header no-cache. Pastikan file lock safe (SQLite WAL sudah handle).
- **Bottom nav:** Karena multi-html, setiap halaman harus render ulang. Sudah ada helper.
- **Error handling:** Semua pakai try/catch + toast.
- **Performance:** Untuk riwayat, batasi jika data banyak (tapi untuk MVP cukup load all dengan filter default hari ini).

## Gate Checklist

- [ ] `GET /api/ringkasan` mengembalikan semua field dengan tipe number
- [ ] `GET /api/riwayat` mengembalikan items dari semua tipe
- [ ] `GET /api/backup` download file .db valid
- [ ] Setting halaman bisa ubah nama + backup
- [ ] Dashboard index pakai ringkasan (angka match)
- [ ] Riwayat halaman berfungsi dengan filter
- [ ] Bottom tab 5 item di semua halaman
- [ ] Semua test API baru lolos
- [ ] `npm start` + manual flow lengkap

## File Ownership (mengikuti pola sebelumnya)

- Coder A (Backend): routes/ringkasan.js, routes/riwayat.js, update setting.js + server.js + tests
- Coder B (Frontend): halaman setting/riwayat + update index + app.js + css

---

**Catatan:** Sprint 4 menyelesaikan G5. Setelah ini tinggal Sprint 5 (PWA + QA + Release).

Dibuat berdasarkan sprint.md, prd2.md, dan state codebase setelah Sprint 3 (transaksi inti sudah ada).