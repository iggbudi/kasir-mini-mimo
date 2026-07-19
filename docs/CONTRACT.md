# Contract Kasir Mini

**Sprint 1:** Auth MVP (sudah selesai)
**Sprint 3:** Transaksi Inti (pemasukan, pengeluaran, kasbon)

---

## Scope (Sprint 1 + Sprint 3)

Login single admin + pencatatan transaksi inti untuk warung.

Default admin: `admin` / `admin123`.

## Response Standar

Success:

```json
{ "success": true, "data": {}, "message": null }
```

Error:

```json
{ "success": false, "data": null, "message": "Pesan error" }
```

## Security (dari Sprint 1)

- Password disimpan sebagai bcrypt hash.
- Session memakai token acak 32 byte, cookie `sid` HttpOnly.
- Session yang disimpan di DB adalah hash SHA-256 dari token cookie.
- Cookie: `HttpOnly`, `SameSite=Lax`, `Secure` saat `NODE_ENV=production`.
- Masa session: 12 jam default via `SESSION_HOURS`.
- Error login salah harus generik: `Username atau password salah`.
- Semua `/api/*` selain auth dan health wajib login.

## Endpoints

### GET `/api/health`

Publik.

Response 200:

```json
{ "status": "ok", "db": "connected" }
```

### Auth Endpoints (Sprint 1)

Lihat bagian lama di bawah untuk detail login/logout/me.

---

## Sprint 3 — Transaksi

### Konvensi Umum

| Item | Format |
|------|--------|
| Tanggal query `dari`/`sampai` | `YYYY-MM-DD` (inklusif) |
| Tanggal response | `YYYY-MM-DD HH:mm:ss` (localtime) |
| Mata uang | Integer Rupiah, tanpa desimal |
| Status kasbon | `belum_lunas` \| `lunas` |
| Default filter tanggal | Hari ini |

Validasi filter tanggal:
- `dari` dan `sampai` harus dikirim berpasangan.
- Format wajib `YYYY-MM-DD` dan harus merupakan tanggal kalender yang valid.
- `dari` tidak boleh setelah `sampai`.
- Semua perhitungan "hari ini" menggunakan timezone `Asia/Jakarta`.

Untuk `POST` transaksi, client dapat mengirim header `Idempotency-Key` (8-100 karakter: huruf, angka, `.`, `_`, `:`, atau `-`). Pengulangan key dengan payload yang sama mengembalikan transaksi sebelumnya tanpa membuat duplikat. Penggunaan key yang sama untuk payload berbeda ditolak dengan response 409.

Transaksi keuangan tidak dihapus permanen. Endpoint `DELETE` melakukan pembatalan logis dan menerima body opsional `{ "reason": "..." }`. Record yang dibatalkan tetap ada di backup dan riwayat audit, tetapi tidak masuk daftar aktif atau perhitungan kas.

### Master Barang

Master barang menyimpan harga default tanpa mengubah histori transaksi lama. Nama dan harga pada detail penjualan tetap disimpan sebagai snapshot.

Field:

| Field | Aturan |
|---|---|
| `nama` | Wajib, unik tanpa membedakan kapital/spasi ganda, maksimal 100 karakter |
| `harga_retail` | Integer positif |
| `harga_grosir` | Opsional, integer positif dan tidak melebihi harga retail |
| `aktif` | `1` aktif, `0` diarsipkan |

Endpoint:

| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/api/barang?status=aktif&q=` | Daftar/filter master barang |
| POST | `/api/barang` | Tambah barang |
| PUT | `/api/barang/:id` | Ubah nama dan harga |
| DELETE | `/api/barang/:id` | Arsipkan tanpa menghapus histori |
| POST | `/api/barang/:id/aktifkan` | Aktifkan kembali barang |

UI penjualan menyediakan pilihan eksplisit `Retail` atau `Grosir` jika barang memiliki harga grosir. Harga satuan tetap dapat disesuaikan sebagai harga khusus sebelum transaksi disimpan.

### Master Salesman

Field bisnis hanya `nama`. Nama unik tanpa membedakan kapital dan spasi ganda, maksimal 100 karakter. Metadata status/tanggal dikelola sistem agar data dapat diarsipkan tanpa hard delete.

| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/api/salesman?status=aktif&q=` | Daftar atau pencarian salesman |
| POST | `/api/salesman` | Tambah `{ "nama": "Budi" }` |
| PUT | `/api/salesman/:id` | Ubah nama salesman |
| DELETE | `/api/salesman/:id` | Arsipkan salesman |
| POST | `/api/salesman/:id/aktifkan` | Aktifkan kembali salesman |

### Kulakan

Kulakan memakai model master-detail berdasarkan salesman. Satu header memilih satu salesman aktif dan memiliki satu atau lebih detail master barang. Harga beli disimpan sebagai snapshot dan tidak mengubah harga retail/grosir master barang.

```json
{
  "salesman_id": 1,
  "items": [
    { "barang_id": 2, "quantity": 10, "harga_beli": 12000 }
  ]
}
```

| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/api/kulakan?dari=&sampai=` | Daftar header kulakan aktif |
| POST | `/api/kulakan` | Simpan header/detail secara atomik |
| GET | `/api/kulakan/:id` | Detail kulakan |
| DELETE | `/api/kulakan/:id` | Batalkan dampak kas tanpa menghapus audit |

Nomor kulakan dibuat otomatis dengan format `KL-YYYYMMDD-ID`. Kulakan dianggap dibayar langsung dan mengurangi kas pada tanggal transaksi. Pembatalan menghapus dampaknya dari kas. Fitur ini tidak mengubah stok karena aplikasi belum memiliki pencatatan inventory.

### Penjualan

Penjualan memakai model master-detail: satu header transaksi memiliki satu atau lebih detail barang. Tidak ada field pelanggan, uang diterima, kembalian, maupun nama toko pada nota.

#### POST `/api/penjualan`

Header opsional `Idempotency-Key` didukung.

```json
{
  "jenis_harga": "grosir",
  "items": [
    { "barang_id": 1, "quantity": 2, "harga": 15000 },
    { "barang_id": 2, "quantity": 1, "harga": 12000 }
  ]
}
```

`jenis_harga` (`retail` | `grosir`) berada pada header penjualan dan berlaku untuk seluruh detail berdasarkan `penjualan_id`. Harga per barang tetap dapat disesuaikan. Saat header Grosir dipilih, UI memakai harga grosir master jika tersedia dan fallback ke harga retail jika tidak tersedia. Server mengambil nama barang aktif dari master lalu menyimpan nama, harga, quantity, dan subtotal sebagai snapshot detail. Nomor nota dibuat otomatis dengan format `PJ-YYYYMMDD-ID`.

#### GET `/api/penjualan?dari=&sampai=`

Mengembalikan daftar header penjualan beserta nomor nota, total, tanggal, dan jumlah item. Transaksi pemasukan lama ikut dikembalikan sebagai penjualan satu item dengan flag `legacy=1`.

#### GET `/api/penjualan/:id`

Mengembalikan header dan seluruh detail untuk preview/cetak nota. Untuk transaksi lama gunakan query `?legacy=1`.

#### DELETE `/api/penjualan/:id`

Membatalkan header dan seluruh detail secara atomik. Untuk transaksi lama gunakan query `?legacy=1`.

Nota hanya berisi nomor nota, tanggal, jenis penjualan, detail barang, dan total. Mode cetak menggunakan layout thermal 58 mm (bukan A4), margin nol, area konten sempit, dan font monospace. Driver printer tetap perlu memakai paper size 58 mm/Receipt, margin none, dan skala 100%.

### Pemasukan Lama (Kompatibilitas)

Endpoint berikut dipertahankan untuk client/data lama dan tidak digunakan oleh UI Penjualan baru.

#### GET `/api/pemasukan?dari=&sampai=`

Query opsional. Jika tidak ada, kembalikan data hari ini saja.

Response 200:

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "barang": "Beras 5kg",
      "quantity": 2,
      "harga": 15000,
      "total": 30000,
      "catatan": null,
      "tanggal": "2026-06-24 10:15:00"
    }
  ],
  "message": null
}
```

#### POST `/api/pemasukan`

Body:

```json
{
  "barang_id": 12,
  "barang": "Beras 5kg",
  "quantity": 2,
  "harga": 15000,
  "catatan": "Pelanggan langganan"
}
```

Validasi:
| Field | Aturan |
|---|---|
| barang_id | opsional untuk kompatibilitas; jika diisi harus menunjuk master aktif |
| barang | wajib jika `barang_id` tidak diisi; menjadi snapshot nama transaksi |
| quantity | wajib, integer ≥ 1 |
| harga | wajib, integer > 0 |
| catatan | opsional, max 200 karakter |

Response 200: record lengkap termasuk `id`, `total`, `tanggal`.

Response 400: pesan error Bahasa Indonesia.

#### DELETE `/api/pemasukan/:id`

Body opsional:

```json
{ "reason": "Salah input nominal" }
```

Response 200 menandai transaksi sebagai dibatalkan. Response 404: `"ID tidak ditemukan"`.

---

### Pengeluaran

#### GET `/api/pengeluaran?dari=&sampai=`

Sama seperti pemasukan.

#### POST `/api/pengeluaran`

Body:

```json
{
  "keterangan": "Listrik bulan ini",
  "nominal": 50000,
  "catatan": null
}
```

Validasi:
| Field | Aturan |
|---|---|
| keterangan | wajib, 1-100 karakter |
| nominal | wajib, integer > 0 |
| catatan | opsional |

#### DELETE `/api/pengeluaran/:id`

Sama seperti pemasukan.

---

### Kasbon

#### GET `/api/kasbon?status=`

- `status=belum_lunas` (default)
- `status=lunas`
- `status=semua`

Nilai status lain ditolak dengan response 400.

Response termasuk `sisa` dan `status`.

#### POST `/api/kasbon`

Body:

```json
{
  "nama": "Budi",
  "nominal": 100000,
  "keterangan": "Beli beras"
}
```

Validasi:
| Field | Aturan |
|---|---|
| nama | wajib, 1-50 karakter |
| nominal | wajib, integer > 0 |

Saat create: `sisa = nominal`, `status = 'belum_lunas'`.

#### POST `/api/kasbon/:id/bayar`

Body:

```json
{ "bayar": 40000 }
```

Validasi:
- `bayar > 0`
- `bayar <= sisa` saat ini
- Kasbon harus `belum_lunas`

Efek:
- Kurangi `sisa`
- Jika `sisa <= 0` → `status = 'lunas'`, `sisa = 0`
- Simpan record di `kasbon_bayar`

Response:

```json
{
  "success": true,
  "data": {
    "kasbon": { ... },
    "pembayaran": { "id": ..., "bayar": 40000, ... }
  },
  "message": null
}
```

Response 400 jika bayar melebihi sisa.

Update saldo dan pencatatan pembayaran dilakukan dalam satu write transaction. Jika saldo berubah oleh request lain sebelum update, response 409 dikembalikan dan client harus memuat ulang data.

#### DELETE `/api/kasbon/:id`

Membatalkan kasbon secara logis. Semua pembayaran terkait ikut ditandai batal dalam write transaction yang sama sehingga tidak lagi memengaruhi ringkasan kas. Kasbon dan pembayaran tetap terlihat di riwayat audit.

---

## Ringkasan dan Riwayat

### GET `/api/ringkasan`

Ringkasan kas harian menggunakan rumus:

```text
total_kas_masuk = pemasukan_penjualan + pembayaran_kasbon
total_kas_keluar = pengeluaran + kulakan
sisa_kas = total_kas_masuk - total_kas_keluar
```

Field utama:

| Field | Arti |
|---|---|
| `pemasukan_penjualan` | Total penjualan tunai hari ini |
| `pembayaran_kasbon` | Total pembayaran kasbon yang diterima hari ini |
| `total_kas_masuk` | Penjualan tunai + pembayaran kasbon |
| `pengeluaran` | Total biaya operasional hari ini |
| `kulakan` | Total pembelian barang dari salesman hari ini |
| `total_kas_keluar` | Pengeluaran operasional + kulakan |
| `sisa_kas` | Total kas masuk dikurangi pengeluaran |
| `kasbon_outstanding` | Total sisa seluruh kasbon aktif |
| `kasbon_aktif` | Jumlah record kasbon yang belum lunas |

Field `pemasukan` tetap tersedia sebagai alias `pemasukan_penjualan` untuk kompatibilitas client lama. Field `kasbon_jumlah_orang` tetap tersedia sebagai alias `kasbon_aktif`, tetapi tidak menyatakan jumlah pelanggan unik.

### GET `/api/riwayat?dari=&sampai=`

Setiap item memiliki field tambahan:

| Field | Nilai | Arti |
|---|---|---|
| `arah` | `masuk` | Menambah kas: penjualan atau pembayaran kasbon |
| `arah` | `keluar` | Mengurangi kas: pengeluaran |
| `arah` | `non_kas` | Tidak mengubah kas: pembuatan kasbon |
| `dampak_kas` | integer | Perubahan kas bertanda; positif masuk, negatif keluar, nol non-kas/batal |
| `dibatalkan` | `0` \| `1` | Menandakan transaksi telah dibatalkan |
| `voided_at` | datetime \| `null` | Waktu pembatalan |
| `void_reason` | string \| `null` | Alasan pembatalan |

### GET `/api/backup`

Menghasilkan JSON dari satu consistent read transaction. Metadata backup:

| Field | Arti |
|---|---|
| `format` | Selalu `kasir-mini-backup` |
| `schema_version` | Versi migration database |
| `exported_at` | Waktu export ISO-8601 |
| `counts` | Jumlah record setiap tabel |
| `checksum_sha256` | Checksum bagian data backup |

Backup mencakup master barang, master salesman, header/detail penjualan dan kulakan, transaksi aktif, dan transaksi yang dibatalkan. Restore tidak disediakan sebagai endpoint HTTP; jalankan dari lingkungan tepercaya:

```bash
RESTORE_CONFIRM=RESTORE_KASIR_MINI npm run db:restore -- path/backup.json
```

Restore memverifikasi format, versi schema, counts, dan checksum sebelum mengganti data dalam satu write transaction. Akun admin dan session tidak ikut diganti.

---

## Auth Endpoints (Sprint 1) - Detail

### POST `/api/auth/login`

Body:

```json
{ "username": "admin", "password": "admin123" }
```

Validasi:

| Field | Aturan |
|---|---|
| username | wajib, string tidak kosong |
| password | wajib, string tidak kosong |

Response 200:

```json
{ "success": true, "data": { "username": "admin" }, "message": null }
```

Response 400:

```json
{ "success": false, "data": null, "message": "Username wajib diisi" }
```

Response 401:

```json
{ "success": false, "data": null, "message": "Username atau password salah" }
```

### GET `/api/auth/me`

Response 200:

```json
{ "success": true, "data": { "username": "admin" }, "message": null }
```

Response 401:

```json
{ "success": false, "data": null, "message": "Belum login" }
```

### POST `/api/auth/logout`

Response 200:

```json
{ "success": true, "data": { "logged_out": true }, "message": null }
```


## Scope

Login single admin untuk Aplikasi Kasir Mini. Username default `admin`, password default `admin123`, bisa dioverride dengan environment variable `ADMIN_USERNAME` dan `ADMIN_PASSWORD` saat `npm run db:init`.

## Response Standar

Success:

```json
{ "success": true, "data": {}, "message": null }
```

Error:

```json
{ "success": false, "data": null, "message": "Pesan error" }
```

## Security

- Password disimpan sebagai bcrypt hash.
- Session memakai token acak 32 byte, cookie `sid` HttpOnly.
- Session yang disimpan di DB adalah hash SHA-256 dari token cookie.
- Cookie: `HttpOnly`, `SameSite=Lax`, `Secure` saat `NODE_ENV=production`.
- Masa session: 12 jam default via `SESSION_HOURS`.
- Error login salah harus generik: `Username atau password salah`.
- Semua `/api/*` selain auth dan health wajib login.

## Endpoints

### GET `/api/health`
Publik.

Response 200:

```json
{ "status": "ok", "db": "connected" }
```

### POST `/api/auth/login`

Body:

```json
{ "username": "admin", "password": "admin123" }
```

Validasi:

| Field | Aturan |
|---|---|
| username | wajib, string tidak kosong |
| password | wajib, string tidak kosong |

Response 200:

```json
{ "success": true, "data": { "username": "admin" }, "message": null }
```

Response 400:

```json
{ "success": false, "data": null, "message": "Username wajib diisi" }
```

Response 401:

```json
{ "success": false, "data": null, "message": "Username atau password salah" }
```

### GET `/api/auth/me`

Response 200:

```json
{ "success": true, "data": { "username": "admin" }, "message": null }
```

Response 401:

```json
{ "success": false, "data": null, "message": "Belum login" }
```

### POST `/api/auth/logout`

Response 200:

```json
{ "success": true, "data": { "logged_out": true }, "message": null }
```
