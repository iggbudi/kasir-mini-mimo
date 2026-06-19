# Product Requirements Document (PRD)
## Aplikasi Kasir Mini — Warung Sembako

**Versi**: 1.0  
**Tanggal**: 2026-06-19  
**Target Pengguna**: Pemilik warung sembako dengan perangkat low-end

---

## 1. Ringkasan

Aplikasi kasir sederhana berbasis web untuk mencatat **pemasukan**, **pengeluaran**, dan **kasbon** (hutang pelanggan) di warung sembako. Tidak ada fitur inventory kompleks, tidak ada sistem multi-cabang — cukup untuk kebutuhan pencatatan harian pemilik warung.

---

## 2. Kondisi Pengguna

| Aspek | Kondisi |
|-------|---------|
| **Perangkat** | HP Android low-end (RAM 1-2GB, layar 5-6") |
| **Koneksi** | Maks 10 Mbps, sering putus-putus |
| **Literasi digital** | Dasar — bisa pakai WhatsApp, sosmed |
| **Kebutuhan utama** | Cepat, tidak ribet, tidak banyak klik |

> **Prinsip utama**: Setiap transaksi harus selesai dalam maksimal **3 tap**.

---

## 3. Fitur yang TIDAK dibuat

Demi kesederhanaan dan fokus:

- ~~Manajemen produk / SKU / barcode~~
- ~~Manajemen stok / inventaris~~
- ~~Pencetakan struk thermal~~
- ~~Multi-user / role~~
- ~~Laporan grafik kompleks~~
- ~~Integrasi payment gateway~~
- ~~Multi-metode bayar~~
- ~~Sistem loyalitas / poin~~
- ~~Manajemen supplier~~

---

## 4. Fitur yang Dibuat

### 4.1 Pemasukan (Penjualan)

Catatan setiap kali uang masuk dari penjualan.

**Yang perlu dicatat:**
- Nama barang (teks bebas, tidak perlu dari database produk)
- Jumlah (quantity)
- Harga satuan
- Total otomatis
- Catatan opsional (misal: "beli 3kg beras")

**Aksi:**
- Tombol "Tambah Pemasukan" → form simpel → simpan
- Daftar pemasukan hari ini (default)
- Filter tanggal (harian, mingguan, bulanan)
- Total pemasukan terlihat jelas di bagian atas

### 4.2 Pengeluaran

Catatan setiap kali uang keluar dari kas warung.

**Yang perlu dicatat:**
- Keterangan pengeluaran (misal: "beli gas", "bayar listrik", "isi ulang air galon")
- Nominal (Rp)
- Tanggal & waktu
- Catatan opsional

**Aksi:**
- Tombol "Tambah Pengeluaran" → form simpel → simpan
- Daftar pengeluaran hari ini
- Filter tanggal
- Total pengeluaran terlihat jelas

### 4.3 Kasbon (Hutang Pelanggan)

Catatan siapa yang berhutang dan sudah bayar.

**Yang perlu dicatat:**
- Nama pelanggan (teks bebas)
- Nominal hutang
- Keterangan (misal: "beli rokok 2 bungkus")
- Status: Belum Lunas / Lunas
- Tanggal

**Aksi:**
- Tombol "Tambah Kasbon" → form simpel → simpan
- Daftar kasbon yang belum lunas (default view)
- Tombol "Bayar" → input nominal bayar → kurangi sisa hutang
- Filter: semua / belum lunas / lunas
- Total kasbon outstanding terlihat di atas

### 4.4 Ringkasan Harian (Dashboard)

Halaman utama yang langsung terlihat saat buka aplikasi.

```
┌─────────────────────────────┐
│   WARUNG SUKMA              │
│   Minggu, 19 Juni 2026     │
├─────────────────────────────┤
│                             │
│  Pemasukan hari ini         │
│  Rp 1.250.000               │
│                             │
│  Pengeluaran hari ini       │
│  Rp 350.000                 │
│                             │
│  ─────────────────────      │
│  Sisa kas: Rp 900.000       │
│                             │
│  Kasbon belum lunas         │
│  Rp 275.000 (3 orang)       │
│                             │
├─────────────────────────────┤
│  [+ Pemasukan]              │
│  [+ Pengeluaran]            │
│  [+ Kasbon]                 │
└─────────────────────────────┘
```

---

## 5. Halaman Aplikasi

| Halaman | Route | Fungsi |
|---------|-------|--------|
| **Dashboard** | `/` | Ringkasan kas hari ini, tombol aksi cepat |
| **Pemasukan** | `/pemasukan` | Form tambah + daftar pemasukan |
| **Pengeluaran** | `/pengeluaran` | Form tambah + daftar pengeluaran |
| **Kasbon** | `/kasbon` | Form tambah + daftar kasbon + bayar |
| **Riwayat** | `/riwayat` | Semua transaksi, filter tanggal |
| **Pengaturan** | `/setting` | Nama warung, backup data |

**Navigasi**: Bottom tab bar (seperti WhatsApp) — 5 tombol di bawah layar, mudah di-capai dengan ibu jari.

---

## 6. Stack Teknologi

| Komponen | Pilihan | Alasan |
|----------|---------|--------|
| **Backend** | Node.js + Express | Ringan, mudah deploy |
| **Frontend** | Vanilla HTML/CSS/JS + PWA | Tidak perlu framework berat, load cepat di HP low-end |
| **Database** | SQLite via better-sqlite3 | Single file, tidak perlu install DB server |
| **CSS** | Tailwind CSS (CDN) | Utility-first, ukuran kecil |
| **Icons** | Lucide Icons (CDN) | Ringan |
| **Offline** | Service Worker (PWA) | Bisa dipakai tanpa internet setelah pertama kali load |

### Mengapa tidak React/Vue/Next.js?

HP RAM 1-2GB dengan Chrome akan struggle dengan SPA framework besar. Vanilla JS + PWA adalah pilihan paling ringan. Service Worker memastikan aplikasi bisa dipakai **offline** — sangat penting untuk koneksi internet yang tidak stabil.

---

## 7. Spesifikasi UI/UX

### Prinsip Desain
1. **Big touch target** — tombol minimal 48px, idealnya 56px
2. **Font besar** — minimal 16px body, 18px untuk angka nominal
3. **Warna kontras tinggi** — mudah dilihat di layar kecil
4. **Minimal input** — auto-fill tanggal/waktu, nominal format ribuan otomatis
5. **Konfirmasi sebelum simpan** — hindari salah ketik

### Format Angka
```
Input:    125000
Display:  Rp 125.000
```
Gunakan titik sebagai pemisah ribuan, format Rupiah konsisten.

---

## 8. Database Schema

```sql
-- Pemasukan
CREATE TABLE pemasukan (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  barang     TEXT NOT NULL,
  quantity   INTEGER DEFAULT 1,
  harga      INTEGER NOT NULL,
  total      INTEGER GENERATED ALWAYS AS (quantity * harga) STORED,
  catatan    TEXT,
  tanggal    TEXT DEFAULT (datetime('now', 'localtime'))
);

-- Pengeluaran
CREATE TABLE pengeluaran (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  keterangan TEXT NOT NULL,
  nominal    INTEGER NOT NULL,
  catatan    TEXT,
  tanggal    TEXT DEFAULT (datetime('now', 'localtime'))
);

-- Kasbon
CREATE TABLE kasbon (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  nama       TEXT NOT NULL,
  nominal    INTEGER NOT NULL,
  sisa       INTEGER NOT NULL,
  keterangan TEXT,
  status     TEXT DEFAULT 'belum_lunas',
  tanggal    TEXT DEFAULT (datetime('now', 'localtime'))
);

-- Pembayaran Kasbon
CREATE TABLE kasbon_bayar (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  kasbon_id  INTEGER REFERENCES kasbon(id),
  bayar      INTEGER NOT NULL,
  tanggal    TEXT DEFAULT (datetime('now', 'localtime'))
);

-- Pengaturan
CREATE TABLE setting (
  key   TEXT PRIMARY KEY,
  value TEXT
);
```

> **Total: 5 tabel** — cukup untuk semua kebutuhan pencatatan.

---

## 9. API Endpoints

### Pemasukan
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/pemasukan?dari=&sampai=` | Daftar pemasukan (default: hari ini) |
| POST | `/api/pemasukan` | Tambah pemasukan |
| DELETE | `/api/pemasukan/:id` | Hapus pemasukan |

### Pengeluaran
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/pengeluaran?dari=&sampai=` | Daftar pengeluaran |
| POST | `/api/pengeluaran` | Tambah pengeluaran |
| DELETE | `/api/pengeluaran/:id` | Hapus pengeluaran |

### Kasbon
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/kasbon?status=` | Daftar kasbon (filter: belum_lunas/lunas/semua) |
| POST | `/api/kasbon` | Tambah kasbon baru |
| POST | `/api/kasbon/:id/bayar` | Catat pembayaran kasbon |
| DELETE | `/api/kasbon/:id` | Hapus kasbon |

### Ringkasan
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/ringkasan` | Total pemasukan, pengeluaran, kasbon hari ini |
| GET | `/api/riwayat?dari=&sampai=` | Semua transaksi gabungan |

### Backup
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/backup` | Download database sebagai file |

---

## 10. Spesifikasi Teknis

### Ukuran & Performa
| Target | Batas |
|--------|-------|
| Ukuran HTML pertama kali load | < 100KB (tanpa gambar) |
| Waktu load di HP 3G | < 3 detik |
| Waktu respons tombol | < 200ms |
| Ukuran total aplikasi (cached) | < 500KB |

### PWA Requirements
- `manifest.json` — nama, ikon, warna tema
- Service Worker — cache semua aset statis
- Bisa "Install" dari browser ke home screen HP
- **Offline mode** — semua data tersimpan di SQLite (backend), tapi untuk mode murni offline pertimbangkan IndexedDB sebagai fallback

### Offline Strategy
```
Online mode:
  Browser → API (Node.js) → SQLite
  
Offline mode:
  Browser → Service Worker → Cache
  
Catatan: 
  - Form tetap bisa diisi offline
  - Data tersimpan lokal dulu (IndexedDB)
  - Saat online, sync ke server
```

> Untuk MVP: Aplikasi harus tetap jalan walau internet mati. Gunakan strategi **cache-first** untuk aset, dan **queue** untuk data yang belum terkirim.

---

## 11. Pengaturan Toko

Pengguna bisa mengatur:
- **Nama warung** — muncul di dashboard dan backup file
- **Logo** (opsional) — untuk backup report
- **Backup data** — tombol download file `.db` (SQLite database)

---

## 12. File Struktur Proyek

```
kasir-mini/
├── server.js              # Entry point Node.js
├── package.json
├── db/
│   └── kasir.db           # SQLite database
├── public/
│   ├── index.html         # Dashboard
│   ├── pemasukan.html
│   ├── pengeluaran.html
│   ├── kasbon.html
│   ├── riwayat.html
│   ├── setting.html
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── app.js         # Shared logic
│   │   ├── pemasukan.js
│   │   ├── pengeluaran.js
│   │   ├── kasbon.js
│   │   └── riwayat.js
│   ├── manifest.json
│   └── sw.js              # Service Worker
├── routes/
│   ├── pemasukan.js
│   ├── pengeluaran.js
│   ├── kasbon.js
│   └── ringkasan.js
└── prd2.md
```

---

## 13. Milestone

| Fase | Yang Dikerjakan | Durasi |
|------|-----------------|--------|
| **Fase 1** | Setup project, DB schema, dashboard, form pemasukan & pengeluaran | 1 minggu |
| **Fase 2** | Fitur kasbon (tambah + bayar), riwayat, filter tanggal | 3-4 hari |
| **Fase 3** | PWA (service worker, manifest), offline mode | 3-4 hari |
| **Fase 4** | Testing di HP real, optimasi UI, backup data | 2-3 hari |

**Total: ± 2.5 minggu**

---

## 14. Cara Pakai Pengguna Akhir

1. Pemilik warung buka aplikasi di browser HP
2. Langsung lihat ringkasan kas hari ini
3. Setiap ada penjualan → tap "Pemasukan" → isi barang + harga → simpan
4. Setiap ada pengeluaran → tap "Pengeluaran" → isi keterangan + nominal → simpan
5. Kalau ada yang berhutang → tap "Kasbon" → isi nama + nominal → simpan
6. Kalau sudah bayar hutang → buka kasbon → tap "Bayar" → input nominal → simpan
7. Di pengaturan → backup database secara berkala (download file .db)

---

*PRD ini fokus pada kesederhanaan. Lebih baik fitur sedikit tapi dipakai setiap hari, daripada fitur banyak tapi tidak pernah dipakai.*
