# Kasir Mini

Aplikasi kasir sederhana berbasis web untuk warung sembako kecil. Mendukung pencatatan pemasukan, pengeluaran, kasbon (hutang pelanggan), dashboard, riwayat, dan backup. Bisa di-install sebagai PWA dan digunakan offline (graceful).

## Fitur Utama
- Login admin sederhana
- Pemasukan (penjualan): tambah, lihat daftar, hapus
- Pengeluaran: tambah, lihat, hapus
- Kasbon: tambah, bayar bertahap, lihat status
- Dashboard ringkasan hari ini
- Riwayat semua transaksi dengan filter tanggal
- Pengaturan: ubah nama warung + backup database
- Bottom tab navigation
- PWA: bisa di-install, cache-first offline
- Offline graceful: UI navigable, form tidak submit saat offline, toast notifikasi

## Cara Menjalankan

1. Pastikan Node.js terinstall.
2. Clone repo atau extract.
3. Jalankan:
   ```
   npm install
   npm run db:init
   npm start
   ```
4. Buka http://localhost:3000 di browser.
5. Login default: `admin` / `admin123`

## PWA & Install
- Buka di Chrome/Edge di HP atau desktop.
- Klik ikon install di address bar.
- Service worker akan cache aset untuk offline.

Saat offline:
- Bisa navigasi antar halaman.
- Form submit akan ditolak dengan toast "Tidak ada koneksi".

## Scripts
- `npm start`: Jalankan server
- `npm run db:init`: Reset/init database dengan admin default
- `npm test`: Jalankan semua test API

## Struktur
- `routes/`: API endpoints (auth, pemasukan, dll)
- `public/`: Frontend statis (HTML, CSS, JS)
- `db/`: SQLite (kasir.db)
- `tests/api/`: Test API

## Catatan
- Semua data lokal di SQLite.
- Tidak ada multi-user atau inventory kompleks.
- Untuk production: set NODE_ENV=production, ganti password admin via env.

## Smoke Test
```bash
npm run db:init
npm start
npm test
```

Lihat `sprint.md` untuk roadmap lengkap.
