# Sprint 6 — Turso Database Migration

**Tujuan:** Mengganti SQLite lokal dengan Turso (libSQL) agar aplikasi siap untuk serverless deployment.

## Scope

- Setup Turso database
- Ganti dependency database
- Refactor connection layer ke async
- Update init script
- Update auth middleware

## Tasks

### 1. Persiapan Turso
- Daftar di turso.tech
- Buat database baru (`kasir-mini-prod`)
- Dapatkan `TURSO_DATABASE_URL` dan `TURSO_AUTH_TOKEN`
- Simpan sebagai environment variable lokal untuk testing

### 2. Update Dependencies
- Hapus `better-sqlite3`
- Install `@libsql/client`
- Update `package.json`

### 3. Refactor DB Layer
- Buat `db/connection.js` baru menggunakan `@libsql/client`
- Buat `db/query.js` sebagai helper:
  - `execute(sql, params)`
  - `getOne(sql, params)`
  - `getAll(sql, params)`
- Pastikan client support batch untuk transaksi

### 4. Update db/init.js
- Ubah menjadi async
- Gunakan `await db.execute(...)` untuk semua CREATE TABLE dan INSERT
- Jalankan sebagai script independen

### 5. Update Middleware Auth
- `middleware/auth.js`:
  - `createSession`, `destroySession`, `getUserBySession` → async
  - `attachUser` dan `requireAuth` → async middleware
- Update `server.js` agar support async middleware

## Output

- `db/connection.js` (baru)
- `db/query.js` (baru)
- `db/init.js` (diupdate)
- `middleware/auth.js` (diupdate)
- `package.json` (diupdate)
- `.env.example` (tambah TURSO credentials)

## Testing

- Jalankan `node db/init.js` dengan Turso credentials
- Test login & session flow secara manual
- Pastikan semua tabel terbuat dengan benar

## Gate G7

- Database berhasil dibuat di Turso
- `npm run db:init` jalan tanpa error
- Login dan session management berfungsi dengan Turso
- Semua query sudah pakai async client

**Estimasi:** 1-2 hari kerja
**Owner:** Backend focused
**Dependencies:** None (bisa paralel dengan persiapan Turso account)