# Rencana Fitur Stok — Kasir Mini

**Tanggal:** 2026-08-05
**Status:** Implementasi v8 dan penyempurnaan v9 selesai di branch ini
**Latar belakang:** Diskusi dengan pemilik warung. Aplikasi saat ini tidak punya pencatatan inventory (dikecualikan di prd2, lihat docs/CONTRACT.md). Data jumlah barang di tiap transaksi (detail penjualan & kulakan) sudah tercatat, sehingga stok bisa dihitung dari transaksi.

---

## Keputusan Bisnis (sudah diputuskan)

| No | Keputusan | Pilihan |
|----|-----------|---------|
| 1 | Penjualan saat stok kurang | **Peringatan + penjualan tetap diizinkan** (stok boleh menjadi minus; client dan server tidak membatasi quantity) |
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
2. Untuk setiap detail (barang_id valid), kurangi stok tanpa membatasi stok minimum:
   ```sql
   UPDATE master_barang SET stok = stok - ?, updated_at = ?
   WHERE id = ? AND aktif = 1
   ```
3. Quantity yang melebihi stok tersedia tetap disimpan; stok dapat menjadi minus. Kegagalan hanya terjadi jika barang tidak ditemukan atau diarsipkan.

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
- Saat input quantity > stok: **peringatan** "Stok <nama> tinggal <n>"; quantity tetap dapat disimpan dan stok menjadi minus.
- Stok 0 atau minus tetap dapat dipilih untuk penjualan; tampilkan kondisi stok sebagai peringatan.
- Error validasi lain dari server tetap ditampilkan via `showToast`; stok kurang bukan alasan penolakan.

### 3. Halaman Kulakan — `kulakan.js`

- Saat memilih barang, tampilkan stok saat ini (bantu putuskan jumlah beli).
- Setelah simpan kulakan, stok otomatis bertambah (list reload).

---

## Test (tests/api/)

### `penjualan-stok.test.js` (atau perluasan penjualan.test.js)
1. POST penjualan → stok barang berkurang sesuai quantity.
2. POST penjualan melebihi stok → berhasil, stok menjadi minus sesuai selisih.
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
  2. Jual sesuai stok → stok berkurang; lebih dari stok → peringatan & stok menjadi minus.
  3. Batalkan penjualan → stok kembali.
  4. Kulakan → stok naik; batalkan → turun.
  5. `db:restore` dari backup lama tetap berjalan (migration v8 idempotent).
- Commit: `feat: add stock tracking with sale limit and manual opname` (per bagian bila perlu).

---

## Definisi Selesai (DoD)

- [x] Migration v8: kolom `stok` + tabel `stok_adjustment` (idempotent, restore lama tetap jalan) — `db/migrations.js`, `db/restore.js`, `routes/backup.js`
- [x] Penjualan: stok turun otomatis dan boleh menjadi minus; void mengembalikan; tidak double-restore — `routes/penjualan.js` + `tests/api/penjualan-stok.test.js`
- [x] Kulakan: stok naik otomatis; void mengurangi (boleh minus) — `routes/kulakan.js` + `tests/api/kulakan-stok.test.js`
- [x] Opname: PUT `/api/barang/:id/stok` dengan validasi & riwayat — `routes/barang.js` + `tests/api/barang-opname.test.js`
- [x] UI: Master Barang (stok + Isi Stok + badge Habis), Jual (stok tersedia + peringatan tanpa pembatasan quantity), Kulakan (tampil stok) — `barang.js`, `pemasukan.js`, `kulakan.js`, `app.js` (promptNumber), `style.css`, `sw.js` v17
- [x] Test stok baru dan regresi terkait lulus di environment branch; full suite saat dokumentasi dijalankan: 140 lulus, 1 gagal pada assertion landing page login yang tidak terkait stok.
- [x] Dokumentasi (CONTRACT.md + README) diperbarui

---

## Penyempurnaan v9 — Batas, Kondisi, dan Riwayat Stok

Status: **selesai dan teruji** di branch ini.

- Batas minimum global disimpan pada setting `stok_minimum`, default 5, dan diatur melalui `GET`/`PUT /api/barang/stok-config`.
- `GET /api/barang` mendukung filter `kondisi_stok` (`semua`, `minus`, `habis`, `menipis`, `aman`) bersama `status` dan `q`; respons item menyertakan `kondisi_stok`.
- `GET /api/barang/:id/mutasi` menyediakan pagination dengan default `limit=20`, `offset=0`, dan `has_more`.
- Ledger append-only `stok_mutation` mencatat lima tipe: penjualan, kulakan, batal_penjualan, batal_kulakan, dan opname. Penulisan stok dan ledger dilakukan dalam transaksi yang sama; stok boleh minus, sedangkan opname minimal 0.
- Master Barang menyediakan badge kondisi, pengaturan batas, dan modal **Riwayat Stok**. Ledger hanya mencatat mutasi setelah fitur dirilis; transaksi lama tidak direkonstruksi.
- Backup schema v9 menyertakan `stok_mutation`; restore backup v8 tanpa tabel tersebut tetap didukung.
