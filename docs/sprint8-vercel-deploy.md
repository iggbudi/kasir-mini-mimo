# Sprint 8 — Vercel Deployment

**Tujuan:** Deploy aplikasi Kasir Mini ke Vercel dengan konfigurasi serverless yang stabil.

## Scope

- Adaptasi server untuk Vercel
- Konfigurasi Vercel
- Penanganan environment & init
- Penyesuaian fitur backup
- Deploy + verifikasi

## Tasks

### 1. Adaptasi Serverless
- `server.js`:
  - Export `module.exports = app;`
  - Buat `app.listen()` hanya jalan jika `require.main === module`
- Pastikan tidak ada proses blocking di cold start

### 2. Buat vercel.json
Contoh konfigurasi:
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

### 3. Environment Variables
Tambahkan di Vercel:
- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `NODE_ENV=production`
- (opsional) `ADMIN_USERNAME`, `ADMIN_PASSWORD`

### 4. Update Build & Init
- `package.json`:
  ```json
  "scripts": {
    "vercel-build": "npm run db:init || true"
  }
  ```
- Jalankan init di build step atau manual setelah deploy pertama

### 5. Adaptasi Backup
- Opsi:
  A. Hapus endpoint `/api/backup` dulu
  B. Ganti dengan export data via Turso API
  C. Buat endpoint baru yang return SQL dump / JSON

### 6. Update Dokumentasi
- Update `README.md` dengan:
  - Cara setup Turso
  - Cara deploy ke Vercel
  - Environment variables yang dibutuhkan

### 7. Deploy & QA
- Deploy ke Vercel
- Test:
  - Login
  - Semua transaksi
  - Ringkasan & riwayat
  - Ubah nama warung
  - Backup (jika diimplementasikan)
- Test PWA di production URL
- Test cold start behavior

## Output

- `vercel.json`
- `server.js` (diupdate)
- `package.json` (scripts)
- Update `README.md`
- Aplikasi live di Vercel

## Testing

- Semua fitur jalan di production
- Tidak ada error di Vercel logs
- Performance acceptable untuk MVP

## Gate G9

- Berhasil deploy ke Vercel
- Semua E2E flow utama lolos
- Database persisten via Turso
- PWA bisa di-install dari URL production

**Estimasi:** 1-2 hari
**Owner:** DevOps + Fullstack
**Dependencies:** Sprint 7 sudah selesai