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

### Pemasukan

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
  "barang": "Beras 5kg",
  "quantity": 2,
  "harga": 15000,
  "catatan": "Pelanggan langganan"
}
```

Validasi:
| Field | Aturan |
|---|---|
| barang | wajib, 1-100 karakter |
| quantity | wajib, integer ≥ 1 |
| harga | wajib, integer > 0 |
| catatan | opsional, max 200 karakter |

Response 200: record lengkap termasuk `id`, `total`, `tanggal`.

Response 400: pesan error Bahasa Indonesia.

#### DELETE `/api/pemasukan/:id`

Response 200 jika sukses.

Response 404: `"ID tidak ditemukan"`

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

#### DELETE `/api/kasbon/:id`

Sama seperti yang lain. Catatan: pembayaran terkait ikut terhapus via FK CASCADE.

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
