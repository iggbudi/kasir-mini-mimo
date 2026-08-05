# Rencana Fitur Stok — Kasir Mini

**Tanggal:** 2026-08-05
**Status:** Direncanakan (belum dieksekusi)
**Latar belakang:** Diskusi dengan pemilik warung. Aplikasi saat ini tidak punya pencatatan inventory (dikecualikan di prd2, lihat docs/CONTRACT.md). Data jumlah barang di tiap transaksi (detail penjualan & kulakan) sudah tercatat, sehingga stok bisa dihitung dari transaksi.

---

## Keputusan Bisnis (sudah diputuskan)

| No | Keputusan | Pilihan |
|----|-----------|---------|
| 1 | Penjualan saat stok kurang | **Peringatan + hanya bisa jual sesuai stok tersedia** (client membatasi input, server menolak jika melebihi) |
| 2 | Stok awal saat fitur aktif | **Isi manual per barang** di halaman Master Barang (stok opname) |

## Keputusan Desain (diusulkan, butuh konfirmasi saat review)

- Stok **diturunkan dari transaksi** (bukan kolom yang diedit bebas): kulakan masuk → stok naik, penjualan → stok turun, void membalikkan efeknya. Konsisten dengan riwayat.
- Transaksi **lama** (pemasukan standalone / sebelum fitur) **tidak** menyentuh stok. Stok mulai dihitung dari opname awal.
- Void kulakan yang membuat stok minus: **diizinkan** (kasus jarang: pembelian dibatalkan padahal barang sudah terjual). Stok bisa minus; kasir bisa perbaiki via opname.
- Alert stok menipis (`min_stok`): **ditunda** (opsional, tidak mengubah desain inti).
- Semua perubahan stok **di dalam write-transaction yang sama** dengan transaksi penjualan/kulakan/void agar atomik.

---

## Skema Database (migration v8)

```sql
-- Kolom baru di master_barang
ALTER TABLE master_barang ADD COLUMN stok INTEGER NOT NULL DEFAULT 0;

-- Tabel opname (riwayat penyesuaian stok)
CREATE TABLE IF NOT EXISTS stok_adjustment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  barang_id INTEGER NOT NULL REFERENCES master_barang(id),
  stok_sebelum INTEGER NOT NULL,
  stok_sesudah INTEGER NOT NULL,
  catatan TEXT,
  tanggal TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS idx_stok_adjustment_barang ON stok_adjustment(barang_id);
```

Catatan: `PRAGMA table_info` pattern yang sudah ada di `db/migrations.js` dipakai via `ensureColumn`.

---

## Backend

### 1. Penjualan — `routes/penjualan.js`

**POST `/api/penjualan`** (dalam satu write-transaction, urutan):
1. Insert header + detail (seperti sekarang).
2. Untuk setiap detail (barang_id valid), kurangi stok dengan **conditional update**:
   ```sql
   UPDATE master_barang SET stok = stok - ?, updated_at = ?
   WHERE id = ? AND aktif = 1 AND stok >= ?
   ```
3. Jika `rowsAffected` jumlah detail < jumlah barang unik → rollback + respons 409 `Stok barang <nama> tidak cukup (sisa <stok>)`. (Rollback otomatis oleh exception di dalam `withWriteTransaction`.)

**DELETE `/api/penjualan/:id`** (void):
1. SELECT detail non-voided (`barang_id`, `quantity`) terlebih dahulu.
2. Void header + detail (seperti sekarang).
3. Untuk tiap detail non-voided dengan `barang_id` tidak null: `UPDATE master_barang SET stok = stok + ? WHERE id = ?`.
4. Barang yang diarsipkan tetap di-restore stoknya (barang boleh arsip setelah transaksi).

### 2. Kulakan — `routes/kulakan.js`

**POST `/api/kulakan`**: setelah insert header+item, tiap item `UPDATE master_barang SET stok = stok + ? WHERE id = ?` dalam transaksi yang sama.

**DELETE `/api/kulakan/:id`** (void):
1. SELECT items kulakan (`barang_id`, `quantity`).
2. Void header (seperti sekarang).
3. Tiap item dengan `barang_id` tidak null: `UPDATE master_barang SET stok = stok - ? WHERE id = ?` (tanpa syarat `stok >=` → minus diizinkan, lihat keputusan desain).

### 3. Opname — `routes/barang.js`

**PUT `/api/barang/:id/stok`** — body `{ stok, catatan? }`:
- Validasi: `stok` integer ≥ 0; `catatan` opsional maks 200 karakter.
- Dalam satu transaksi:
  1. SELECT stok saat ini (404 jika barang tidak ada).
  2. INSERT `stok_adjustment` (stok_sebelum, stok_sesudah, catatan).
  3. UPDATE `master_barang.stok`.
- `GET /api/barang` : tambah `stok` ke `PUBLIC_COLUMNS` (response otomatis menyertakannya).

### 4. Yang TIDAK disentuh

- `POST /api/pemasukan` (transaksi standalone legacy) — tidak menyentuh stok; didokumentasikan.
- `routes/ringkasan.js`, `routes/riwayat.js` — tidak berubah.

---

## Frontend

### 1. Master Barang — `barang.html` / `barang.js`

- List: kolom **Stok** per barang + badge `Habis` saat 0.
- Tombol **Isi Stok** per barang → modal input angka + catatan opsional → `PUT /api/barang/:id/stok`.
- Form tambah barang: tetap tanpa field stok (default 0); stok diisi lewat Isi Stok.

### 2. Halaman Jual — `pemasukan.html` / `pemasukan.js`

- Combobox & product browser: tampilkan **Stok tersedia** di samping harga.
- Saat input quantity > stok: **peringatan** "Stok <nama> tinggal <n>" dan **jumlah dibatasi** ke stok (validasi client + `max`).
- Stok 0 → item tidak bisa ditambahkan (pesan "Stok habis").
- Error 409 dari server (stok berubah/sisa kurang) ditampilkan via `showToast`.

### 3. Halaman Kulakan — `kulakan.js`

- Saat memilih barang, tampilkan stok saat ini (bantu putuskan jumlah beli).
- Setelah simpan kulakan, stok otomatis bertambah (list reload).

---

## Test (tests/api/)

### `penjualan-stok.test.js` (atau perluasan penjualan.test.js)
1. POST penjualan → stok barang berkurang sesuai quantity.
2. POST penjualan melebihi stok → 409, stok tidak berubah (transaksi rollback).
3. DELETE penjualan (void) → stok kembali ke nilai semula.
4. Void dua kali → stok tidak di-restore dua kali.

### `kulakan-stok.test.js`
1. POST kulakan → stok bertambah.
2. DELETE kulakan (void) → stok berkurang (boleh minus).

### `barang-opname.test.js`
1. PUT stok → stok tersimpan + ada riwayat stok_adjustment.
2. PUT stok negatif → 400.
3. PUT stok barang tidak ada → 404.

---

## Verifikasi & Rilis

- `node --check` semua file yang diubah (bisa di Termux).
- Full `npm test` + cek manual di lingkungan dengan deps:
  1. Isi stok awal via Master Barang → terlihat di Jual.
  2. Jual sesuai stok → stok berkurang; lebih dari stok → peringatan & dibatasi.
  3. Batalkan penjualan → stok kembali.
  4. Kulakan → stok naik; batalkan → turun.
  5. `db:restore` dari backup lama tetap berjalan (migration v8 idempotent).
- Commit: `feat: add stock tracking with sale limit and manual opname` (per bagian bila perlu).

---

## Definisi Selesai (DoD)

- [x] Migration v8: kolom `stok` + tabel `stok_adjustment` (idempotent, restore lama tetap jalan) — `db/migrations.js`, `db/restore.js`, `routes/backup.js`
- [x] Penjualan: stok turun otomatis; melebihi stok ditolak 409; void mengembalikan; tidak double-restore — `routes/penjualan.js` + `tests/api/penjualan-stok.test.js`
- [x] Kulakan: stok naik otomatis; void mengurangi (boleh minus) — `routes/kulakan.js` + `tests/api/kulakan-stok.test.js`
- [x] Opname: PUT `/api/barang/:id/stok` dengan validasi & riwayat — `routes/barang.js` + `tests/api/barang-opname.test.js`
- [x] UI: Master Barang (stok + Isi Stok + badge Habis), Jual (stok tersedia + batasan + peringatan), Kulakan (tampil stok) — `barang.js`, `pemasukan.js`, `kulakan.js`, `app.js` (promptNumber), `style.css`, `sw.js` v17
- [ ] Test baru hijau; test lama tidak rusak — **belum dieksekusi di Termux** (libsql tolak Android); hanya `node --check`
- [x] Dokumentasi (CONTRACT.md + README) diperbarui
