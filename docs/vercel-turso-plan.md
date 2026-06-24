# Rencana B: Migrasi ke Turso + Deploy ke Vercel

## Tujuan
Membuat aplikasi **kasir-mini** dapat di-deploy ke Vercel dengan database yang persisten dan cocok untuk serverless environment.

## Mengapa Turso?
- Kompatibel dengan SQLite (sintaks hampir sama)
- Serverless & edge-friendly
- Bisa diakses via HTTP (tidak butuh file system lokal)
- Gratis untuk tier kecil
- Client resmi `@libsql/client`

## Masalah Saat Ini
- Menggunakan `better-sqlite3` (synchronous, file-based)
- Database lokal `db/kasir.db` tidak akan persisten di Vercel
- Semua query synchronous → harus diubah menjadi async

## Langkah-langkah Implementasi

### 1. Persiapan Turso
1. Daftar di https://turso.tech
2. Install Turso CLI (opsional, untuk management)
3. Buat database baru:
   ```bash
   turso db create kasir-mini-prod
   ```
4. Dapatkan credentials:
   ```bash
   turso db show kasir-mini-prod --url
   turso db tokens create kasir-mini-prod
   ```
   Simpan:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`

### 2. Update Dependencies
Hapus:
- `better-sqlite3`

Tambah:
```bash
npm install @libsql/client
```

Update `package.json` (hapus better-sqlite3 dari dependencies).

### 3. Refactor Layer Database

**File baru / diubah:** `db/connection.js`

```js
// db/connection.js
const { createClient } = require('@libsql/client');

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

module.exports = client;
```

**Catatan:** Turso client menggunakan async API.

### 4. Buat Helper Query (Opsional tapi Direkomendasikan)

Buat `db/query.js` untuk memudahkan:

```js
const db = require('./connection');

async function execute(sql, params = []) {
  const result = await db.execute({ sql, args: params });
  return result;
}

async function getOne(sql, params = []) {
  const result = await db.execute({ sql, args: params });
  return result.rows[0] || null;
}

async function getAll(sql, params = []) {
  const result = await db.execute({ sql, args: params });
  return result.rows;
}

module.exports = { execute, getOne, getAll };
```

### 5. Update db/init.js

Ubah menjadi async migration script:

- Gunakan `execute` untuk CREATE TABLE dan INSERT
- Jalankan sebagai `node db/init.js` sebelum deploy atau di Vercel build step
- Buat tabel jika belum ada (gunakan `CREATE TABLE IF NOT EXISTS`)

Contoh:
```js
await db.execute(`CREATE TABLE IF NOT EXISTS ...`);
```

### 6. Update Semua Tempat yang Menggunakan DB

File yang perlu diubah (semua harus async):

**Middleware:**
- `middleware/auth.js`
  - `createSession`, `destroySession`, `getUserBySession`, `attachUser`, `requireAuth` → jadikan async

**Routes:**
- `routes/auth.js`
- `routes/setting.js`
- `routes/pemasukan.js`
- `routes/pengeluaran.js`
- `routes/kasbon.js`
- `routes/ringkasan.js`
- `routes/riwayat.js`
- `routes/backup.js` (perlu diadaptasi — lihat poin 8)

**Server:**
- `server.js` → health check dan mount routes harus handle async

**Contoh perubahan query:**
```js
// Sebelum (sync)
const user = db.prepare('SELECT ...').get(username);

// Sesudah (async)
const result = await db.execute({
  sql: 'SELECT ...',
  args: [username]
});
const user = result.rows[0];
```

### 7. Adaptasi untuk Vercel (Serverless)

**server.js:**
- Hapus atau kondisikan `app.listen()`
- Export app:
  ```js
  module.exports = app;
  ```

**vercel.json:**
```json
{
  "version": 2,
  "builds": [
    { "src": "server.js", "use": "@vercel/node" }
  ],
  "routes": [
    { "src": "/(.*)", "dest": "server.js" }
  ]
}
```

Atau lebih modern (Vercel 3+):
```json
{
  "functions": {
    "server.js": {
      "includeFiles": "db/**"
    }
  }
}
```

### 8. Penanganan Fitur Khusus

**Backup:**
- Endpoint `/api/backup` saat ini download file lokal.
- Solusi:
  - Gunakan Turso API untuk backup (https://docs.turso.tech/api-reference)
  - Atau buat export ke JSON/CSV
  - Atau hilangkan fitur backup dulu untuk versi Vercel

**Init Database:**
- Jalankan `npm run db:init` secara manual setelah deploy pertama, atau tambahkan di `vercel.json` build command.

**Environment Variables di Vercel:**
- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `NODE_ENV=production`
- (opsional) `ADMIN_USERNAME`, `ADMIN_PASSWORD`

### 9. Update Script

`package.json`:
```json
"scripts": {
  "start": "node server.js",
  "dev": "node --watch server.js",
  "test": "node --test tests/**/*.test.js",
  "db:init": "node db/init.js",
  "vercel-build": "npm run db:init && echo 'DB initialized'"
}
```

### 10. Langkah Deploy

1. Push semua perubahan ke GitHub
2. Di Vercel:
   - Import project
   - Tambahkan Environment Variables
   - Set Build Command: `npm run vercel-build` (atau kosongkan)
   - Deploy
3. Setelah deploy pertama, pastikan `db:init` sudah jalan (bisa manual via Vercel dashboard atau tambah di build)

### Potensi Tantangan & Solusi

| Tantangan | Solusi |
|-----------|--------|
| Semua query harus async | Gunakan `async/await` + ubah middleware menjadi async |
| Transaksi (kasbon bayar) | Gunakan `db.batch([...])` atau `db.transaction()` jika didukung |
| Performance | Turso cepat, tapi tambah connection pooling jika perlu (client sudah handle) |
| Testing lokal | Tetap bisa pakai Turso (buat dev database) atau sementara pakai better-sqlite3 dengan flag |
| Backup | Implementasi via Turso API atau ganti dengan export data |

### Estimasi Perubahan

- **File diubah:** ~15-20 file
- **Perubahan besar:** Middleware auth + semua routes
- **Waktu estimasi:** 4-8 jam (tergantung testing)

### Rekomendasi Tambahan

1. Buat branch terpisah: `feature/turso-vercel`
2. Update `docs/CONTRACT.md` jika perlu
3. Tambahkan dokumentasi cara setup Turso di README
4. Pertimbangkan menggunakan Drizzle ORM atau Prisma nanti untuk kemudahan (opsional)

---

**Next Step yang Disarankan:**
Setelah plan ini disetujui, kita bisa mulai implementasi langkah demi langkah (mulai dari connection layer).

Apakah mau saya mulai implementasi sekarang? Atau ada bagian yang ingin direvisi dulu?