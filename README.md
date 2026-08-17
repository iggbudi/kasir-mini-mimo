# Kasir Mini

Aplikasi kasir sederhana berbasis web untuk warung sembako kecil. Mendukung penjualan multi-barang, pengeluaran, kasbon (hutang pelanggan), dashboard, riwayat, nota, dan backup.

## Fitur Utama
- Login admin sederhana
- Master barang: nama, harga retail, harga grosir opsional, arsip
- Stok: otomatis bertambah saat kulakan & berkurang saat penjualan; opname manual per barang; penjualan tetap diperbolehkan meski stok tidak mencukupi sehingga stok dapat menjadi minus. Master Barang juga menyediakan batas stok minimum global, filter & badge kondisi stok (Minus/Habis/Menipis/Aman), dan riwayat mutasi stok per barang. Panduan pemakaian: `docs/panduan-stok.md`
- Master salesman: tambah, edit, cari, arsip, dan aktifkan kembali nama salesman
- Penjualan master-detail: status Retail/Grosir pada header transaksi, harga detail dapat disesuaikan, preview dan cetak nota thermal 58 mm
- Kulakan master-detail berdasarkan salesman dan master barang; total langsung mengurangi kas
- Pengeluaran: tambah, lihat, batalkan dengan jejak audit, filter tanggal
- Kasbon: tambah, bayar bertahap, batalkan dengan jejak audit, lihat status + progress bar
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

## Deploy ke VPS (nginx + systemd)

Deploy utama aplikasi ini adalah VPS dengan nginx sebagai reverse proxy dan
systemd sebagai process manager. Contoh konfigurasi sudah disediakan di
folder `deploy/` (dipakai untuk `tanisubur.nanariset.my.id`).
Karena coding dan deploy di VPS yang sama, perubahan langsung aktif untuk
file `public/` (nginx menyajikan dari disk); perubahan backend cukup
`sudo systemctl restart kasir-mini`. Push ke GitHub hanya backup kode —
tidak memicu deploy.

### 1. Prasyarat

- Ubuntu 22.04/24.04, Node.js 18+ (via nvm atau distro), `node_modules` sudah
  terinstall (`npm install`), dan `.env` sudah diisi (`TURSO_DATABASE_URL`,
  `TURSO_AUTH_TOKEN`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`).
- Domain sudah diarahkan (A record) ke IP VPS.
- nginx dan certbot terinstall:
  ```bash
  sudo apt-get update
  sudo apt-get install -y nginx certbot python3-certbot-nginx
  ```

### 2. Service systemd

Salin `deploy/kasir-mini.service` ke `/etc/systemd/system/`, sesuaikan path
Node jika bukan dari nvm, lalu:

```bash
sudo cp deploy/kasir-mini.service /etc/systemd/system/kasir-mini.service
sudo systemctl daemon-reload
sudo systemctl enable --now kasir-mini
systemctl status kasir-mini
```

Catatan unit file:

- `WorkingDirectory=/home/ubuntu/kasir-mini-mimo` — sesuaikan dengan lokasi repo.
- `EnvironmentFile=.../.env` — variabel dari `.env` di-load; karena `.env`
  berisi `PORT`, service memakai wrapper `export PORT=3001` agar tidak bentrok
  dengan proses lain di port 3000.
- `Environment=NODE_ENV=production` — memaksa mode production.

### 3. Vhost nginx

Salin `deploy/nginx-kasir-mini.conf`, ganti `server_name` dan
`proxy_pass` (port sesuai service), lalu:

```bash
sudo cp deploy/nginx-kasir-mini.conf /etc/nginx/sites-available/kasir-mini
sudo ln -sf /etc/nginx/sites-available/kasir-mini /etc/nginx/sites-enabled/kasir-mini
sudo nginx -t
sudo systemctl reload nginx
```

> ⚠️ **Jangan menimpa konfigurasi di `sites-available` setelah certbot**
> memodifikasinya — block 443/SSL buatan certbot akan hilang dan HTTPS mati.
> Jika terlanjur, jalankan ulang `sudo certbot --nginx -d domain` atau tulis
> block 443 lengkap seperti di `deploy/nginx-kasir-mini.conf`.

### 4. SSL Let's Encrypt

```bash
sudo certbot --nginx -d DOMAIN_ANDA --redirect --non-interactive --agree-tos --register-unsafely-without-email
```

Auto-renew ditangani `certbot.timer` (sudah aktif otomatis). Verifikasi:
`sudo certbot renew --dry-run`.

### 5. Verifikasi

```bash
curl -s https://DOMAIN_ANDA/api/health        # {"status":"ok","db":"connected"}
curl -sI https://DOMAIN_ANDA | head -3        # 302 → /login.html
systemctl is-active kasir-mini nginx          # active active
```

## Environment Variables

| Variable | Required | Default | Deskripsi |
|----------|----------|---------|-----------|
| `TURSO_DATABASE_URL` | Ya | `file:db/kasir.db` | URL database Turso atau file lokal |
| `TURSO_AUTH_TOKEN` | Untuk remote | - | Auth token Turso |
| `PORT` | Tidak | `3000` | Port server lokal |
| `SESSION_HOURS` | Tidak | `12` | Durasi session (jam) |
| `LOGIN_MAX_ATTEMPTS` | Tidak | `5` | Percobaan login gagal sebelum lockout (per IP) |
| `LOGIN_WINDOW_SEC` | Tidak | `900` | Durasi window pencacah percobaan (detik) |
| `LOGIN_LOCK_SEC` | Tidak | `900` | Durasi lockout setelah ambang tercapai (detik) |
| `ADMIN_USERNAME` | Tidak | `admin` | Username admin |
| `ADMIN_PASSWORD` | Ya (prod) | - | Password admin. **Build production gagal jika kosong** (bukan default `admin123`) |
| `NODE_ENV` | Tidak | - | Set `production` untuk mode produksi (dipakai unit systemd) |

## Scripts
- `npm start`: Jalankan server
- `npm run dev`: Jalankan dengan auto-reload
- `npm run db:init`: Inisialisasi schema dan jalankan migration database
- `npm run db:restore -- path/backup.json`: Restore backup JSON (wajib `RESTORE_CONFIRM=RESTORE_KASIR_MINI`)
- `npm test`: Jalankan semua test API & UI (node:test)

## Struktur
```
├── db/
│   ├── connection.js   # LibSQL client (@libsql/client)
│   ├── query.js        # Helper query + transaction
│   ├── migrations.js   # Migration schema versioned
│   ├── restore.js      # Restore backup tervalidasi
│   └── init.js         # Bootstrap schema + seed + migrations
├── middleware/
│   └── auth.js         # Session management (async)
├── utils/
│   ├── stock.js        # Klasifikasi kondisi stok + helper mutasi ledger
│   └── ...             # Response, validasi, tanggal, env
├── routes/
│   ├── auth.js         # Login/logout/me
│   ├── setting.js      # Nama warung
│   ├── barang.js       # Master barang + stok (config, filter, riwayat mutasi)
│   ├── salesman.js     # Master nama salesman
│   ├── kulakan.js      # Kulakan master-detail
│   ├── penjualan.js    # Penjualan master-detail + nota
│   ├── pemasukan.js    # Kompatibilitas transaksi lama
│   ├── pengeluaran.js  # CRUD pengeluaran
│   ├── kasbon.js       # CRUD kasbon + bayar
│   ├── ringkasan.js    # Dashboard stats
│   ├── riwayat.js      # Gabungan transaksi
│   └── backup.js       # Export JSON
├── public/             # Frontend statis
├── tests/api/          # Test API (node:test)
├── deploy/             # Contoh deploy VPS (systemd + nginx)
└── server.js           # Express app
```

## Backup dan Restore

Backup diunduh dari halaman Pengaturan atau endpoint `GET /api/backup`. File berisi versi schema, jumlah record, checksum SHA-256, master barang, dan transaksi yang dibatalkan.

Restore mengganti seluruh data transaksi dan pengaturan, tetapi tidak mengubah akun admin maupun session:

```bash
RESTORE_CONFIRM=RESTORE_KASIR_MINI npm run db:restore -- ./kasir-backup-YYYYMMDD.json
```

Checksum, jumlah record, format, dan kompatibilitas versi schema diverifikasi sebelum restore. Restore dijalankan dalam satu write transaction sehingga kegagalan akan di-rollback.

## Smoke Test
```bash
npm run db:init
npm start
npm test
```

## Tech Stack
- **Backend**: Express.js, @libsql/client (Turso)
- **Auth**: Cookie session, bcryptjs, rate limit login (in-memory)
- **Security**: helmet + CSP parsial (blokir exfiltration/plugin/clickjacking)
- **Frontend**: Vanilla HTML/CSS/JS (no framework)
- **Database**: Turso (libSQL/SQLite)
- **Deploy**: VPS (nginx + systemd, port 3001); GitHub sebagai backup kode
- **Test**: Node.js built-in test runner

Lihat `docs/sprint.md` untuk roadmap lengkap.
