# Product Requirements Document (PRD)
## Aplikasi Kasir Mini — Warung Sembako

**Versi**: 2.0  
**Tanggal**: 2026-06-19  
**Target Pengguna**: Pemilik warung sembako dengan perangkat low-end  
**Dikerjakan oleh**: Multi-Agent AI Coding System

---

## 1. Ringkasan

Aplikasi kasir sederhana berbasis web untuk mencatat **pemasukan**, **pengeluaran**, dan **kasbon** (hutang pelanggan) di warung sembako. Tidak ada fitur inventory kompleks, tidak ada sistem multi-cabang — cukup untuk kebutuhan pencatatan harian pemilik warung.

---

## 2. Topologi Agent & Kolaborasi

### 2.1 Arsitektur Multi-Agent

```
┌──────────────────────────────────────────────────────────────┐
│                     USER (Manusia)                           │
│              Memberikan instruksi awal                        │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                SUPERVISOR AGENT                               │
│              (Manajer / Koordinator)                         │
│                                                              │
│  • Menerima instruksi dari user                               │
│  • Memecah menjadi tugas-tugas kecil (task decomposition)    │
│  • Merutekan tugas ke sub-agent yang tepat                    │
│  • Mengumpulkan hasil dari sub-agent                          │
│  • Melakukan review kualitas                                  │
│  • Menggabungkan output menjadi produk akhir                  │
│  • Menangani retry jika ada kegagalan                         │
└───────┬──────────┬──────────┬──────────┬─────────────────────┘
        │          │          │          │
        ▼          ▼          ▼          ▼
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ ARCHITECT│ │  CODER   │ │  CODER   │ │  TESTER  │
│  AGENT   │ │ AGENT A  │ │ AGENT B  │ │  AGENT   │
│          │ │(Backend) │ │(Frontend)│ │          │
│ • Desain │ │ • API    │ │ • HTML   │ │ • Unit   │
│ • Schema │ │ • Routes │ │ • CSS    │ │ • API    │
│ • Struktur│ │ • DB     │ │ • JS     │ │ • UI     │
│ • Spesifikasi│ │ Logic │ │ • PWA    │ │ • E2E    │
└──────────┘ └──────────┘ └──────────┘ └──────────┘
        │          │          │          │
        └──────────┴──────────┴──────────┘
                           │
                           ▼
                ┌─────────────────────┐
                │   OUTPUT AKHIR      │
                │   (Kode Siap)       │
                └─────────────────────┘
```

### 2.2 Deskripsi Peran Agent

| Agent | Peran | Input | Output |
|-------|-------|-------|--------|
| **Supervisor** | Manajer proyek, koordinator | Instruksi user | Aplikasi final yang terintegrasi |
| **Architect** | Perancang sistem & struktur | Fitur dari Supervisor | Schema DB, struktur folder, spesifikasi API |
| **Coder A (Backend)** | Pengembang server & database | Spesifikasi dari Architect | File JS backend, routes, DB setup |
| **Coder B (Frontend)** | Pengembang UI & client | Spesifikasi dari Architect | HTML, CSS, JS client, PWA files |
| **Tester** | Verifikasi & validasi | Kode dari Coder A & B | Laporan bug, status lolos/gagal |

### 2.3 Alur Kerja (Workflow)

```
FLOW 1: Inisialisasi
═══════════════════════════════════════════
User ──► Supervisor ──► Architect
                            │
                            ▼
                     Buat spesifikasi:
                     • DB schema
                     • API endpoints
                     • File structure
                     • UI wireframe
                            │
                            ▼
                     Kembalikan ke Supervisor
                            │
                            ▼
                       Review & Approve

FLOW 2: Parallel Development
═══════════════════════════════════════════
Supervisor ──┬──► Coder A (Backend) ──┐
             │                        ├──► Supervisor
             └──► Coder B (Frontend) ─┘        │
                                               │
                                          Merge & Integrate
                                               │
                                               ▼
                                          Kode Terintegrasi

FLOW 3: Verification
═══════════════════════════════════════════
Supervisor ──► Tester ──► Jalankan semua test
                            │
                            ├──► PASS ──► Serahkan ke User
                            │
                            └──► FAIL ──► Supervisor
                                               │
                                               ▼
                                          Kirim ke Coder
                                          untuk perbaikan
                                               │
                                               ▼
                                          Ulangi FLOW 3
```

### 2.4 Protokol Komunikasi Antar Agent

Setiap komunikasi antar agent menggunakan format standar:

```json
{
  "from": "supervisor",
  "to": "coder_a",
  "task_id": "TASK-001",
  "action": "implement",
  "payload": {
    "description": "Buat API endpoint untuk pemasukan",
    "spec": "...",
    "files": ["routes/pemasukan.js"],
    "depends_on": ["TASK-000"]
  },
  "priority": "high",
  "deadline": null
}
```

```json
{
  "from": "coder_a",
  "to": "supervisor",
  "task_id": "TASK-001",
  "status": "completed",
  "output": {
    "files_created": ["routes/pemasukan.js"],
    "files_modified": ["server.js"],
    "notes": "Endpoint GET, POST, DELETE sudah dibuat"
  }
}
```

### 2.5 Task Decomposition (Pemecahan Tugas)

Supervisor memecah proyek menjadi tugas-tugas berikut:

| Task ID | Deskripsi | Agent | Dependencies |
|---------|-----------|-------|--------------|
| T-001 | Setup project (package.json, folder structure) | Coder A | — |
| T-002 | Buat DB schema (5 tabel) | Architect | — |
| T-003 | Implementasi DB initialization | Coder A | T-002 |
| T-004 | Buat API routes pemasukan | Coder A | T-003 |
| T-005 | Buat API routes pengeluaran | Coder A | T-003 |
| T-006 | Buat API routes kasbon | Coder A | T-003 |
| T-007 | Buat API routes ringkasan | Coder A | T-004, T-005, T-006 |
| T-008 | Buat dashboard HTML | Coder B | T-002 |
| T-009 | Buat halaman pemasukan HTML + JS | Coder B | T-004 |
| T-010 | Buat halaman pengeluaran HTML + JS | Coder B | T-005 |
| T-011 | Buat halaman kasbon HTML + JS | Coder B | T-006 |
| T-012 | Buat halaman riwayat HTML + JS | Coder B | T-007 |
| T-013 | Buat halaman setting HTML + JS | Coder B | — |
| T-014 | Buat CSS (style.css) | Coder B | — |
| T-015 | Buat PWA (manifest.json + sw.js) | Coder B | T-008 s/d T-013 |
| T-016 | Test semua API endpoint | Tester | T-004 s/d T-007 |
| T-017 | Test semua halaman UI | Tester | T-008 s/d T-013 |
| T-018 | Test integrasi frontend-backend | Tester | T-016, T-017 |
| T-019 | Test PWA & offline mode | Tester | T-015 |
| T-020 | Final integration & cleanup | Supervisor | T-018, T-019 |

### 2.6 Dependency Graph

```
T-001 (Setup) ──────────────────────────────────────┐
T-002 (Schema) ──┬──► T-003 (DB Init) ──┬──► T-004 (API Pemasukan) ──┬──► T-007 (API Ringkasan)
                 │                       │                            │
                 │                       ├──► T-005 (API Pengeluaran) ─┤
                 │                       │                            │
                 │                       └──► T-006 (API Kasbon) ─────┘
                 │
                 └──► T-008 (Dashboard) ──┬──► T-009 (Hal Pemasukan)
                                          ├──► T-010 (Hal Pengeluaran)
                                          ├──► T-011 (Hal Kasbon)
                                          ├──► T-012 (Hal Riwayat)
                                          └──► T-013 (Hal Setting)
                                                │
T-014 (CSS) ───────────────────────────────────┼──► T-015 (PWA)
                                                │
                                          T-016, T-017 (Testing)
                                                │
                                          T-018 (Integration Test)
                                                │
                                          T-020 (Final)
```

---

## 3. Kondisi Pengguna

| Aspek | Kondisi |
|-------|---------|
| **Perangkat** | HP Android low-end (RAM 1-2GB, layar 5-6") |
| **Koneksi** | Maks 10 Mbps, sering putus-putus |
| **Literasi digital** | Dasar — bisa pakai WhatsApp, sosmed |
| **Kebutuhan utama** | Cepat, tidak ribet, tidak banyak klik |

> **Prinsip utama**: Setiap transaksi harus selesai dalam maksimal **3 tap**.

---

## 4. Fitur yang TIDAK dibuat

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

## 5. Fitur yang Dibuat

### 5.1 Pemasukan (Penjualan)

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

### 5.2 Pengeluaran

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

### 5.3 Kasbon (Hutang Pelanggan)

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

### 5.4 Ringkasan Harian (Dashboard)

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

## 6. Halaman Aplikasi

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

## 7. Stack Teknologi

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

## 8. Spesifikasi UI/UX

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

## 9. Database Schema

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

## 10. API Endpoints

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

## 11. Spesifikasi Teknis

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

## 12. Pengaturan Toko

Pengguna bisa mengatur:
- **Nama warung** — muncul di dashboard dan backup file
- **Logo** (opsional) — untuk backup report
- **Backup data** — tombol download file `.db` (SQLite database)

---

## 13. File Struktur Proyek

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

## 14. Milestone & Jadwal Agent

### Fase 1: Inisialisasi (Hari 1)
| Task | Agent | Output |
|------|-------|--------|
| Setup project | Coder A | package.json, folder structure |
| Buat DB schema | Architect | Schema SQL, ERD |
| Setup database | Coder A | db/kasir.db, db/init.js |

### Fase 2: Backend Development (Hari 2-3)
| Task | Agent | Output |
|------|-------|--------|
| API Pemasukan | Coder A | routes/pemasukan.js |
| API Pengeluaran | Coder A | routes/pengeluaran.js |
| API Kasbon | Coder A | routes/kasbon.js |
| API Ringkasan | Coder A | routes/ringkasan.js |
| Test Backend | Tester | Laporan test API |

### Fase 3: Frontend Development (Hari 3-5)
| Task | Agent | Output |
|------|-------|--------|
| Dashboard | Coder B | public/index.html |
| Halaman Pemasukan | Coder B | public/pemasukan.html + JS |
| Halaman Pengeluaran | Coder B | public/pengeluaran.html + JS |
| Halaman Kasbon | Coder B | public/kasbon.html + JS |
| Halaman Riwayat | Coder B | public/riwayat.html + JS |
| Halaman Setting | Coder B | public/setting.html + JS |
| CSS | Coder B | public/css/style.css |
| Test Frontend | Tester | Laporan test UI |

### Fase 4: Integration & PWA (Hari 5-6)
| Task | Agent | Output |
|------|-------|--------|
| Integrasi FE-BE | Supervisor | Kode terintegrasi |
| PWA Setup | Coder B | manifest.json, sw.js |
| Test Integrasi | Tester | Laporan test E2E |
| Test PWA & Offline | Tester | Laporan test PWA |

### Fase 5: Final (Hari 6-7)
| Task | Agent | Output |
|------|-------|--------|
| Cleanup & refactor | Supervisor | Kode bersih |
| Final review | Supervisor | Checklist selesai |
| Deliver ke user | Supervisor | Aplikasi siap pakai |

---

## 15. Instruksi untuk Agent

### Untuk Supervisor Agent:
```
Kamu adalah Supervisor Agent yang mengkoordinasi pembuatan aplikasi kasir mini.

Tugasmu:
1. Menerima instruksi dari user
2. Membuat task list berdasarkan PRD
3. Merutekan tugas ke agent yang tepat
4. Memastikan setiap task selesai sebelum lanjut
5. Menggabungkan semua output
6. Melakukan quality check sebelum deliver

Format output: Gunakan task ID (T-xxx) untuk tracking.
```

### Untuk Architect Agent:
```
Kamu adalah Architect Agent yang merancang sistem.

Tugasmu:
1. Membuat database schema berdasarkan PRD
2. Mendesain struktur API
3. Mendefinisikan file structure
4. Membuat wireframe UI (deskripsi tekstual)

Output yang diharapkan:
- SQL schema
- API spec (method, endpoint, request/response)
- Folder structure
- UI layout description
```

### Untuk Coder Agent (Backend):
```
Kamu adalah Coder Agent spesialis backend.

Tugasmu:
1. Implementasi database initialization
2. Buat semua API routes
3. Setup Express server
4. Handle error & validation

Constraint:
- Gunakan better-sqlite3 (synchronous)
- Input validation wajib
- Response format: { success: true/false, data: ..., message: ... }
- Jangan tambahkan fitur yang tidak ada di PRD
```

### Untuk Coder Agent (Frontend):
```
Kamu adalah Coder Agent spesialis frontend.

Tugasmu:
1. Buat semua halaman HTML
2. Buat CSS (Tailwind via CDN)
3. Buat JavaScript client-side
4. Setup PWA (manifest + service worker)

Constraint:
- Vanilla JS, TIDAK pakai React/Vue
- Tailwind CSS via CDN
- Touch target minimal 56px
- Font minimal 16px
- Responsive untuk layar 375px - 1024px
- Format Rupiah: gunakan Intl.NumberFormat
```

### Untuk Tester Agent:
```
Kamu adalah Tester Agent yang memverifikasi aplikasi.

Tugasmu:
1. Test semua API endpoint (POST, GET, DELETE)
2. Test validasi input (field kosong, angka negatif)
3. Test integrasi frontend-backend
4. Test PWA & offline mode
5. Laporkan bug dengan format:
   - Task ID
   - Kondisi (steps to reproduce)
   - Expected
   - Actual
   - Severity (critical/high/medium/low)
```

---

## 16. Cara Pakai Pengguna Akhir

1. Pemilik warung buka aplikasi di browser HP
2. Langsung lihat ringkasan kas hari ini
3. Setiap ada penjualan → tap "Pemasukan" → isi barang + harga → simpan
4. Setiap ada pengeluaran → tap "Pengeluaran" → isi keterangan + nominal → simpan
5. Kalau ada yang berhutang → tap "Kasbon" → isi nama + nominal → simpan
6. Kalau sudah bayar hutang → buka kasbon → tap "Bayar" → input nominal → simpan
7. Di pengaturan → backup database secara berkala (download file .db)

---

*PRD ini fokus pada kesederhanaan. Lebih baik fitur sedikit tapi dipakai setiap hari, daripada fitur banyak tapi tidak pernah dipakai.*
