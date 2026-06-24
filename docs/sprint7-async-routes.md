# Sprint 7 — Async Routes & API

**Tujuan:** Mengubah seluruh layer query database menjadi asynchronous agar kompatibel dengan Turso.

## Scope

- Update semua route files
- Perbaiki logika transaksi
- Update server health check
- Pastikan seluruh API test masih hijau

## Tasks

### 1. Update Route Files
Ubah semua query dari sync ke async:

- `routes/auth.js`
- `routes/setting.js`
- `routes/pemasukan.js`
- `routes/pengeluaran.js`
- `routes/kasbon.js`
- `routes/ringkasan.js`
- `routes/riwayat.js`
- `routes/backup.js`

Contoh perubahan:
```js
// Sebelum
const items = db.prepare(sql).all(...params);

// Sesudah
const result = await db.execute({ sql, args: params });
const items = result.rows;
```

### 2. Perbaiki Transaksi
- `routes/kasbon.js` → `POST /:id/bayar`
  - Ganti `db.transaction()` dengan `db.batch([...])`
  - Pastikan atomic update sisa + insert bayar

### 3. Update Server.js
- `app.get('/api/health')` → jadikan async
- Pastikan semua `app.use('/api/xxx', requireAuth, ...)` support async middleware

### 4. Update Tests
- Semua file di `tests/api/*.test.js` harus tetap lulus
- Tambah test khusus untuk query async jika perlu

### 5. Error Handling
- Pastikan semua error response tetap dalam Bahasa Indonesia
- Tangani error dari Turso client dengan baik

## Output

- 8 route files diupdate ke async
- `server.js` (health check)
- Semua test file (jika ada perubahan)
- Dokumentasi perubahan query pattern di `docs/`

## Testing

- `npm test` harus hijau 100%
- Manual test:
  - Tambah pemasukan
  - Bayar kasbon (partial + lunas)
  - Lihat riwayat & ringkasan
  - Update setting

## Gate G8

- Semua route berjalan dengan Turso
- Transaksi kasbon bayar tetap atomic
- Semua API test lolos
- Tidak ada regression pada fitur yang sudah ada

**Estimasi:** 2-3 hari
**Owner:** Fullstack
**Dependencies:** Sprint 6 (Turso migration) sudah selesai