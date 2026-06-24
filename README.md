# Kasir Mini

Aplikasi kasir sederhana berbasis web untuk warung sembako kecil. Mendukung pencatatan pemasukan, pengeluaran, kasbon (hutang pelanggan), dashboard, riwayat, dan backup.

## Fitur Utama
- Login admin sederhana
- Pemasukan (penjualan): tambah, lihat daftar, hapus, filter tanggal
- Pengeluaran: tambah, lihat, hapus, filter tanggal
- Kasbon: tambah, bayar bertahap, lihat status + progress bar
- Dashboard ringkasan hari ini (quick stats)
- Riwayat semua transaksi dengan filter tanggal
- Pengaturan: ubah nama warung + export backup JSON
- Bottom tab navigation (mobile)
- Custom modal confirm & input Rupiah
- Toast notifikasi

## Cara Menjalankan (Lokal)

1. Pastikan Node.js 18+ terinstall.
2. Clone repo atau extract.
3. Jalankan:
   ```
   npm install
   cp .env.example .env
   npm run db:init
   npm start
   ```
4. Buka http://localhost:3000 di browser.
5. Login default: `admin` / `admin123`

### Menggunakan Database Lokal (file)
Set `.env`:
```
TURSO_DATABASE_URL=file:db/kasir.db
```

### Menggunakan Turso (remote)
Set `.env`:
```
TURSO_DATABASE_URL=libsql://YOUR_DB.turso.io
TURSO_AUTH_TOKEN=your-token
```

## Deploy ke Vercel

### 1. Setup Turso
```bash
# Install Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Login
turso auth login

# Buat database
turso db kasir-mini-prod

# Dapatkan credentials
turso db show kasir-mini-prod --url
turso db tokens create kasir-mini-prod
```

### 2. Deploy
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables
vercel env add TURSO_DATABASE_URL
vercel env add TURSO_AUTH_TOKEN
vercel env add NODE_ENV production
vercel env add ADMIN_PASSWORD your-secure-password

# Deploy ke production
vercel --prod
```

### 3. Init Database di Production
Setelah deploy pertama kali, jalankan init via Vercel:
```bash
# Atau buka endpoint init manual (jika ditambahkan)
```
Database akan ter-inisialisasi otomatis saat build pertama via `vercel-build` script.

## Environment Variables

| Variable | Required | Default | Deskripsi |
|----------|----------|---------|-----------|
| `TURSO_DATABASE_URL` | Ya | `file:db/kasir.db` | URL database Turso atau file lokal |
| `TURSO_AUTH_TOKEN` | Untuk remote | - | Auth token Turso |
| `PORT` | Tidak | `3000` | Port server lokal |
| `SESSION_HOURS` | Tidak | `12` | Durasi session (jam) |
| `ADMIN_USERNAME` | Tidak | `admin` | Username admin |
| `ADMIN_PASSWORD` | Ya (prod) | `admin123` | Password admin |
| `NODE_ENV` | Tidak | - | Set `production` di Vercel |

## Scripts
- `npm start`: Jalankan server
- `npm run dev`: Jalankan dengan auto-reload
- `npm run db:init`: Init/reset database
- `npm test`: Jalankan semua test API (40 tests)
- `npm run vercel-build`: Init database saat build Vercel

## Struktur
```
├── db/
│   ├── connection.js   # LibSQL client (@libsql/client)
│   ├── query.js        # Helper: execute, getOne, getAll, run, batch
│   └── init.js         # Schema + seed (async)
├── middleware/
│   └── auth.js         # Session management (async)
├── routes/
│   ├── auth.js         # Login/logout/me
│   ├── setting.js      # Nama warung
│   ├── pemasukan.js    # CRUD pemasukan
│   ├── pengeluaran.js  # CRUD pengeluaran
│   ├── kasbon.js       # CRUD kasbon + bayar
│   ├── ringkasan.js    # Dashboard stats
│   ├── riwayat.js      # Gabungan transaksi
│   └── backup.js       # Export JSON
├── public/             # Frontend statis
├── tests/api/          # Test API (node:test)
├── vercel.json         # Konfigurasi Vercel
└── server.js           # Express app
```

## Smoke Test
```bash
npm run db:init
npm start
npm test
```

## Tech Stack
- **Backend**: Express.js, @libsql/client (Turso)
- **Auth**: Cookie session, bcryptjs
- **Frontend**: Vanilla HTML/CSS/JS (no framework)
- **Database**: Turso (libSQL/SQLite)
- **Deploy**: Vercel (serverless)
- **Test**: Node.js built-in test runner

Lihat `docs/sprint.md` untuk roadmap lengkap.
