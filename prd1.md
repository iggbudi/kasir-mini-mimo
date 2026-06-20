# Product Requirements Document (PRD)
## Aplikasi Kasir Mini — Warung Sembako

**Versi**: 1.0  
**Tanggal**: 2026-06-19  
**Author**: MiMoCode Agent

---

## 1. Ringkasan Eksekutif

Aplikasi Kasir Mini adalah sistem kasir berbasis web yang dirancang khusus untuk warung sembako kecil dan menengah di Indonesia. Aplikasi ini memungkinkan pemilik warung untuk mengelola transaksi penjualan, inventaris, dan laporan keuangan secara praktis dan efisien tanpa memerlukan perangkat keras khusus — cukup menggunakan browser di komputer, tablet, atau smartphone.

---

## 2. Tujuan & Masalah

### Masalah yang Diselesaikan
- Pencatatan transaksi manual (buku tulis) yang rawan salah dan sulit dilacak
- Tidak adanya data stok yang real-time, menyebabkan kehabisan barang tanpa sadar
- Sulitnya melihat rekap penjualan harian/mingguan/bulanan
- Ketidakakuratan dalam menghitung kembalian dan total belanja
- Tidak ada riwayat transaksi untuk analisis pola penjualan

### Tujuan
- Menyederhanakan proses transaksi kasir menjadi beberapa klik
- Memberikan visibilitas stok barang secara real-time
- Menghasilkan laporan penjualan otomatis
- Menjadi solusi yang ringan, murah, dan mudah diakses

---

## 3. Pengguna Target

| Pengguna | Deskripsi |
|----------|-----------|
| **Pemilik Warung** | Mengelola stok, melihat laporan, mengatur harga |
| **Kasir / Karyawan** | Melakukan transaksi penjualan, mencetak struk |
| **Supervisor** | Memantau performa penjualan dan stok |

---

## 4. Fitur Utama

### 4.1 Manajemen Produk
- [ ] Tambah, edit, dan hapus data produk
- [ ] Kategori produk (sembako, minuman, snack, kebersihan, dll)
- [ ] Satuan-unit (pcs, kg, liter, pack, dus)
- [ ] Harga jual dan harga beli
- [ ] Barcode / SKU (opsional)
- [ ] Gambar produk (opsional)
- [ ] Status aktif/nonaktif produk

### 4.2 Manajemen Stok (Inventaris)
- [ ] Stok masuk (pembelian dari supplier)
- [ ] Stok keluar (penjualan + retur)
- [ ] Stok opname / penyesuaian stok
- [ ] Notifikasi stok menipis (minimum stock alert)
- [ ] Riwayat pergerakan stok (stock movement log)
- [ ] Multi-satuan konversi (1 dus = 12 pcs)

### 4.3 Transaksi Kasir (POS)
- [ ] Pencarian produk (nama, barcode, kategori)
- [ ] Scan barcode (menggunakan kamera smartphone/USB scanner)
- [ ] Keranjang belanja (cart) — tambah, kurang, hapus item
- [ ] Diskon per item atau per transaksi
- [ ] Pajak (PPN 11%) — toggle aktif/nonaktif
- [ ] Multi metode bayar: Tunai, QRIS, Transfer, E-Wallet
- [ ] Perhitungan kembalian otomatis
- [ ] Cetak struk (thermal printer / PDF)
- [ ] Void / pembatalan transaksi
- [ ] Split bill (opsional)

### 4.4 Pengelolaan Pelanggan
- [ ] Daftar pelanggan (nama, no. HP, alamat)
- [ ] Riwayat transaksi per pelanggan
- [ ] Sistem poin / loyalty (opsional)
- [ ] Pelanggan umum (tanpa registrasi)

### 4.5 Manajemen Supplier
- [ ] Data supplier (nama, kontak, alamat)
- [ ] Riwayat pembelian per supplier
- [ ] Hutang supplier (opsional)

### 4.6 Laporan & Analitik
- [ ] Laporan penjualan harian / mingguan / bulanan
- [ ] Laporan produk terlaris (best sellers)
- [ ] Laporan laba rugi
- [ ] Laporan stok (stok akhir, stok menipis)
- [ ] Laporan per kategori
- [ ] Grafik tren penjualan
- [ ] Export laporan ke Excel / PDF

### 4.7 Pengaturan Toko
- [ ] Profil toko (nama, alamat, no. telepon, logo)
- [ ] Pengaturan struk (custom footer, ucapan)
- [ ] Pengaturan pajak (PPN toggle, persentase)
- [ ] Pengaturan diskon default
- [ ] Multi-kasir / multi-user dengan role
- [ ] Backup dan restore data

---

## 5. Arsitektur Sistem

```
┌─────────────────────────────────────────────┐
│              Frontend (Browser)              │
│   HTML + CSS + JavaScript / Framework SPA    │
│   Tailwind CSS / DaisyUI                     │
├─────────────────────────────────────────────┤
│              Backend API                     │
│   Node.js (Express / Hono) atau             │
│   Python (FastAPI / Flask)                   │
├─────────────────────────────────────────────┤
│              Database                        │
│   SQLite (deploy ringan) atau                │
│   PostgreSQL (produksi)                      │
│   Prisma / Drizzle ORM                      │
├─────────────────────────────────────────────┤
│              Print Service                   │
│   Browser Print API / ESC/POS               │
└─────────────────────────────────────────────┘
```

### Stack yang Direkomendasikan

| Komponen | Pilihan Ringan | Pilihan Produksi |
|----------|---------------|-------------------|
| **Frontend** | Vanilla JS + HTMX + Tailwind | Next.js / React + Tailwind |
| **Backend** | Express.js | Hono (edge-ready) |
| **Database** | SQLite | PostgreSQL |
| **ORM** | Prisma | Prisma / Drizzle |
| **Auth** | Session-based | JWT + Refresh Token |
| **Cetak Struk** | Browser Print API | ESC/POS via thermal printer |

---

## 6. Spesifikasi Halaman (Pages)

### 6.1 Halaman Kasir (POS) — `/kasir`
> **Prioritas: P1 — Harus ada sejak awal**

Layout:
```
┌──────────────────────────────┬───────────────────┐
│                              │  Ringkasan         │
│    Pencarian Produk          │  ─────────────     │
│  ┌──────────────────────┐    │  Subtotal: Rp 0   │
│  │ [Scan barcode here]  │    │  Diskon:   Rp 0   │
│  └──────────────────────┘    │  Pajak:    Rp 0   │
│                              │  TOTAL:    Rp 0   │
│    Daftar Produk             │                   │
│  ┌─────┐ ┌─────┐ ┌─────┐   │  [Bayar]           │
│  │  A  │ │  B  │ │  C  │   │                   │
│  └─────┘ └─────┘ └─────┘   │                   │
│  ┌─────┐ ┌─────┐ ┌─────┐   │                   │
│  │  D  │ │  E  │ │  F  │   │                   │
│  └─────┘ └─────┘ └─────┘   │                   │
│                              │                   │
│    ──── Keranjang ────       │                   │
│  Item A  x2    Rp 10.000    │                   │
│  Item B  x1    Rp  5.000    │                   │
│  [Qty+] [Qty-] [Hapus]     │                   │
└──────────────────────────────┴───────────────────┘
```

### 6.2 Halaman Produk — `/produk`
- Tabel daftar produk dengan pencarian & filter kategori
- Tombol "Tambah Produk" → modal form
- Aksi edit / nonaktifkan / hapus
- Import produk dari CSV

### 6.3 Halaman Stok — `/stok`
- Dashboard stok: total item, stok menipis, stok habis
- Form stok masuk (pembelian)
- Riwayat pergerakan stok
- Tombol stok opname

### 6.4 Halaman Laporan — `/laporan`
- Filter rentang tanggal
- Grafik penjualan (line chart / bar chart)
- Tabel rekap transaksi
- Tombol export Excel / PDF

### 6.5 Halaman Transaksi Riwayat — `/transaksi`
- Daftar semua transaksi
- Detail transaksi (klik untuk lihat)
- Cetak ulang struk
- Void transaksi

### 6.6 Halaman Pelanggan — `/pelanggan`
- CRUD pelanggan
- Riwayat belanja per pelanggan

### 6.7 Halaman Pengaturan — `/pengaturan`
- Profil toko
- Pengguna (user management)
- Pengaturan struk
- Backup / Restore
- Pengaturan diskon & pajak

---

## 7. Database Schema (Initial)

```sql
-- Produk
CREATE TABLE products (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  sku           TEXT UNIQUE,
  barcode       TEXT UNIQUE,
  category_id   INTEGER REFERENCES categories(id),
  unit          TEXT DEFAULT 'pcs',
  cost_price    INTEGER DEFAULT 0,
  selling_price INTEGER NOT NULL,
  stock         INTEGER DEFAULT 0,
  min_stock     INTEGER DEFAULT 5,
  image_url     TEXT,
  is_active     INTEGER DEFAULT 1,
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);

-- Kategori
CREATE TABLE categories (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

-- Transaksi
CREATE TABLE transactions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id   INTEGER REFERENCES customers(id),
  user_id       INTEGER REFERENCES users(id),
  subtotal      INTEGER NOT NULL,
  discount      INTEGER DEFAULT 0,
  tax           INTEGER DEFAULT 0,
  total         INTEGER NOT NULL,
  payment_method TEXT DEFAULT 'tunai',
  amount_paid   INTEGER DEFAULT 0,
  change_amount INTEGER DEFAULT 0,
  status        TEXT DEFAULT 'completed', -- completed, voided
  notes         TEXT,
  created_at    TEXT DEFAULT (datetime('now'))
);

-- Item Transaksi
CREATE TABLE transaction_items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id INTEGER REFERENCES transactions(id),
  product_id    INTEGER REFERENCES products(id),
  quantity      INTEGER NOT NULL,
  unit_price    INTEGER NOT NULL,
  discount      INTEGER DEFAULT 0,
  subtotal      INTEGER NOT NULL
);

-- User / Kasir
CREATE TABLE users (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  name     TEXT NOT NULL,
  role     TEXT DEFAULT 'kasir', -- admin, kasir
  is_active INTEGER DEFAULT 1
);

-- Pelanggan
CREATE TABLE customers (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  name    TEXT NOT NULL,
  phone   TEXT,
  address TEXT,
  points  INTEGER DEFAULT 0
);

-- Supplier
CREATE TABLE suppliers (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  name    TEXT NOT NULL,
  phone   TEXT,
  address TEXT
);

-- Stok Masuk (Pembelian)
CREATE TABLE stock_entries (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id  INTEGER REFERENCES products(id),
  supplier_id INTEGER REFERENCES suppliers(id),
  quantity    INTEGER NOT NULL,
  unit_cost   INTEGER NOT NULL,
  notes       TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);

-- Pengaturan Toko
CREATE TABLE store_settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);
```

---

## 8. API Endpoints (REST)

### Auth
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Info user login |

### Produk
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/products` | Daftar produk (paginated, filterable) |
| GET | `/api/products/:id` | Detail produk |
| POST | `/api/products` | Tambah produk |
| PUT | `/api/products/:id` | Edit produk |
| DELETE | `/api/products/:id` | Hapus produk |
| GET | `/api/products/search?q=` | Cari produk |

### Transaksi
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/api/transactions` | Buat transaksi baru |
| GET | `/api/transactions` | Daftar transaksi |
| GET | `/api/transactions/:id` | Detail transaksi |
| POST | `/api/transactions/:id/void` | Void transaksi |

### Stok
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/api/stock/entry` | Stok masuk |
| POST | `/api/stock/adjust` | Stok opname |
| GET | `/api/stock/log` | Riwayat stok |

### Laporan
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/reports/daily` | Laporan harian |
| GET | `/api/reports/monthly` | Laporan bulanan |
| GET | `/api/reports/products` | Laporan produk terlaris |

### Pelanggan
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/customers` | Daftar pelanggan |
| POST | `/api/customers` | Tambah pelanggan |
| PUT | `/api/customers/:id` | Edit pelanggan |

---

## 9. Non-Fungsional

### Performa
- Waktu load halaman kasir: < 2 detik
- Waktu pencarian produk: < 500ms
- Waktu cetak struk: < 1 detik
- Mendukung 500+ produk tanpa lag

### Kompatibilitas
- Browser: Chrome, Firefox, Edge (terbaru)
- Responsive: Desktop, Tablet (min 768px), Smartphone (min 375px)
- Touch-friendly untuk tablet

### Keamanan
- Autentikasi wajib sebelum akses POS
- Password hashing (bcrypt / argon2)
- Role-based access (admin vs kasir)
- Input sanitization
- CSRF protection
- HTTPS (di produksi)

### Cetak Struk
- Format thermal 58mm / 80mm
- Template struk: nama toko, alamat, tanggal, item, total, terima kasih
- Support: Epson TM-T20, Star TSP, dll (via ESC/POS)
- Fallback: cetak via browser print (PDF)

### Data
- Auto-save transaksi per item ditambahkan
- Backup data harian otomatis (download sebagai JSON/SQLite)
- Tidak ada dependency ke internet (offline-capable untuk POS dasar)

---

## 10. Milestone & Timeline

| Fase | Fitur | Durasi Est. |
|------|-------|-------------|
| **Fase 1 — MVP** | Setup project, DB schema, halaman kasir, CRUD produk, transaksi sederhana | 2-3 minggu |
| **Fase 2 — Core** | Manajemen stok, pencetakan struk, riwayat transaksi, laporan dasar | 2 minggu |
| **Fase 3 — Enhance** | Pelanggan, supplier, multi-user, dashboard grafik, export | 2 minggu |
| **Fase 4 — Polish** | Responsive mobile, keyboard shortcuts, backup/restore, optimasi | 1 minggu |

---

## 11. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|--------|--------|----------|
| Printer tidak terdeteksi | Struk tidak bisa dicetak | Fallback ke PDF / browser print |
| Data corrupt / hilang | Transaksi hilang | Auto-backup, SQLite WAL mode |
| Performa lambat dengan banyak data | Kasir lambat | Pagination, indexing, archiving transaksi lama |
| User tidak paham teknologi | Adopsi rendah | UI sederhana, panduan singkat, minimal klik |
| Tidak ada koneksi internet | Tidak bisa akses | Prioritaskan fitur offline-capable |

---

## 12. Sukses Kriteria

- [ ] Kasir dapat melakukan transaksi dalam < 30 detik per item
- [ ] Stok otomatis berkurang setelah transaksi selesai
- [ ] Laporan harian dapat diakses dalam 1 klik
- [ ] Struk tercetak dengan benar (nama, harga, total)
- [ ] Aplikasi dapat dijalankan di tablet dengan nyaman
- [ ] Minimal 1 warung dapat menggunakan untuk operasional harian

---

## 13. Future Consideration

- Integrasi payment gateway (QRIS, OVO, GoPay)
- Multi-cabang / multi-toko
- Promo & voucher management
- Integrasi dengan supplier (auto-order)
- Aplikasi mobile native (PWA → installable)
- Fitur pesan antar (delivery)
- Analitik prediktif (prediksi stok habis)

---

*PRD ini bersifat living document dan akan diperbarui seiring perkembangan proyek.*
