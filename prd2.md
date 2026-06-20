# Product Requirements Document (PRD)
## Aplikasi Kasir Mini — Warung Sembako

**Versi**: 2.1  
**Tanggal**: 2026-06-20  
**Target Pengguna**: Pemilik warung sembako dengan perangkat low-end  
**Dikerjakan oleh**: Multi-Agent AI Coding System (pengganti Agile Squad)

---

## 1. Ringkasan

Aplikasi kasir sederhana berbasis web untuk mencatat **pemasukan**, **pengeluaran**, dan **kasbon** (hutang pelanggan) di warung sembako. Tidak ada fitur inventory kompleks, tidak ada sistem multi-cabang — cukup untuk kebutuhan pencatatan harian pemilik warung.

**Tujuan dokumen ini**: Bukan hanya spesifikasi produk, tetapi **kontrak operasional** untuk squad agile virtual yang dieksekusi oleh agent AI. Setiap agent harus bisa bekerja paralel tanpa konflik file, dengan gate approval yang jelas.

---

## 2. Squad Agile → Agent AI

### 2.1 Pemetaan Peran

| Peran Agile | Agent AI | Fokus | Bukan tugasnya |
|-------------|----------|-------|----------------|
| Product Owner | **User (Manusia)** | Prioritas fitur, approve gate | Menulis kode |
| Scrum Master | **Supervisor** | Routing task, unblock, merge, retry | Implementasi detail |
| Tech Lead / Architect | **Architect** | Contract spec, schema, konvensi | Coding production |
| Backend Developer | **Coder A** | Server, DB, API | HTML/CSS/UI |
| Frontend Developer | **Coder B** | HTML, CSS, JS, PWA | SQL, routes |
| QA Engineer | **Tester** | Verifikasi + laporan bug | Fix bug (hanya report) |

> **Prinsip**: Agent adalah **role prompt + ownership file**, bukan proses terdistribusi otomatis. Supervisor mensimulasikan Scrum Master dengan task DAG dan gate checklist.

### 2.2 Arsitektur Kolaborasi

```
┌──────────────────────────────────────────────────────────────┐
│                     USER (Product Owner)                      │
│         Approve Gate G0 (PRD) · G1 (Contract) · G4 (Ship)    │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                SUPERVISOR (Scrum Master)                      │
│  Decompose · Route · Gate check · Merge · Retry · Deliver    │
└───────┬──────────┬──────────┬──────────┬─────────────────────┘
        │          │          │          │
        ▼          ▼          ▼          ▼
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ ARCHITECT│ │ CODER A  │ │ CODER B  │ │  TESTER  │
│ Contract │ │ Backend  │ │ Frontend │ │   QA     │
└──────────┘ └──────────┘ └──────────┘ └──────────┘
```

### 2.3 Sprint & Gate (Checkpoint)

Supervisor **tidak boleh** memulai sprint berikutnya sebelum gate terpenuhi.

| Gate | Nama | Owner Approve | Syarat Lolos |
|------|------|---------------|--------------|
| **G0** | PRD Freeze | User | PRD v2.x disetujui, scope out-of-scope jelas |
| **G1** | Contract Ready | Supervisor | `docs/CONTRACT.md` lengkap, tidak ada endpoint ambigu |
| **G2** | Foundation Ready | Supervisor | `npm start` jalan, DB init sukses, health check OK |
| **G3** | API Complete | Tester | Semua endpoint T-004–T-008 lolos test API |
| **G4** | UI Complete | Tester | Semua halaman T-009–T-015 lolos checklist UI |
| **G5** | Integration Pass | Tester | E2E flow utama lolos (T-018) |
| **G6** | Ship Ready | User | PWA installable, backup works, README ada |

```
G0 ──► Architect (T-000) ──► G1
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
              Coder A (T-001–003)     Coder B (T-009 shell)
                    │                       │
                    └───────────┬───────────┘
                                ▼
                               G2
                                │
              ┌─────────────────┴─────────────────┐
              ▼                                   ▼
        Coder A (T-004–008)                 Coder B (T-010–015)
              │                                   │
              └─────────────────┬─────────────────┘
                                ▼
                          G3 + G4 (paralel test)
                                │
                                ▼
                    Coder B (T-016 PWA) + Tester (T-017–019)
                                │
                                ▼
                               G5
                                │
                                ▼
                    Supervisor (T-020) ──► G6
```

### 2.4 File Ownership (Cegah Konflik Merge)

| File / Folder | Owner | Agent lain |
|---------------|-------|------------|
| `docs/CONTRACT.md` | Architect | Read-only |
| `server.js` | Coder A | Supervisor merge only |
| `db/**` | Coder A | Read-only |
| `routes/**` | Coder A | Read-only |
| `public/*.html` | Coder B | Read-only |
| `public/css/**` | Coder B | Read-only |
| `public/js/app.js` | Coder B | Coder A tidak ubah |
| `public/js/{page}.js` | Coder B | Per halaman, 1 file per task |
| `public/manifest.json`, `public/sw.js` | Coder B | — |
| `tests/**` | Tester | Coder boleh baca, tidak ubah tanpa assign |
| `package.json` | Coder A | Supervisor approve jika Coder B butuh dep |

**Aturan konflik**: Jika dua agent butuh file yang sama → Supervisor serializes. Default: **Coder A menang** untuk `server.js`; **Coder B menang** untuk `public/**`.

### 2.5 Protokol Komunikasi Antar Agent

Gunakan **task ID `T-xxx`** secara konsisten (bukan `TASK-xxx`).

**Assign task (Supervisor → Agent):**
```json
{
  "from": "supervisor",
  "to": "coder_a",
  "task_id": "T-004",
  "action": "implement",
  "payload": {
    "description": "Implementasi API pemasukan",
    "spec_ref": "docs/CONTRACT.md#pemasukan",
    "files_owned": ["routes/pemasukan.js"],
    "files_readonly": ["docs/CONTRACT.md", "db/init.js"],
    "depends_on": ["T-003"],
    "definition_of_done": ["T-004"]
  }
}
```

**Lapor selesai (Agent → Supervisor):**
```json
{
  "from": "coder_a",
  "to": "supervisor",
  "task_id": "T-004",
  "status": "completed",
  "output": {
    "files_created": ["routes/pemasukan.js"],
    "files_modified": ["server.js"],
    "commands_run": ["npm test -- tests/api/pemasukan.test.js"],
    "notes": "GET/POST/DELETE sesuai contract"
  }
}
```

**Lapor bug (Tester → Supervisor):**
```json
{
  "from": "tester",
  "to": "supervisor",
  "task_id": "T-017",
  "status": "failed",
  "bugs": [{
    "id": "BUG-001",
    "related_task": "T-011",
    "severity": "high",
    "steps": ["Buka /kasbon", "Tap Bayar", "Input 0"],
    "expected": "Error validasi",
    "actual": "Request terkirim, sisa jadi negatif"
  }]
}
```

### 2.6 Task Decomposition

| Task ID | Deskripsi | Agent | Dependencies | Artefak Output |
|---------|-----------|-------|--------------|----------------|
| **T-000** | Buat `docs/CONTRACT.md` (API + konvensi + validasi) | Architect | G0 | `docs/CONTRACT.md` |
| **T-001** | Setup project (`package.json`, folder, scripts) | Coder A | T-000, G1 | `package.json`, struktur folder |
| **T-002** | DB schema + `db/init.js` + seed setting default | Coder A | T-001 | `db/init.js`, `db/kasir.db` |
| **T-003** | Express server + static + health + error middleware | Coder A | T-002 | `server.js` |
| **T-004** | API routes pemasukan | Coder A | T-003 | `routes/pemasukan.js` |
| **T-005** | API routes pengeluaran | Coder A | T-003 | `routes/pengeluaran.js` |
| **T-006** | API routes kasbon + bayar | Coder A | T-003 | `routes/kasbon.js` |
| **T-007** | API ringkasan + riwayat | Coder A | T-004, T-005, T-006 | `routes/ringkasan.js` |
| **T-008** | API setting + backup | Coder A | T-003 | `routes/setting.js` |
| **T-009** | Shared FE: `app.js`, nav, format Rupiah, fetch helper | Coder B | T-000, G1 | `public/js/app.js`, `public/css/style.css` (base) |
| **T-010** | Dashboard `index.html` | Coder B | T-009 | `public/index.html` |
| **T-011** | Halaman pemasukan | Coder B | T-009, T-004 | `public/pemasukan.html`, `public/js/pemasukan.js` |
| **T-012** | Halaman pengeluaran | Coder B | T-009, T-005 | `public/pengeluaran.html`, `public/js/pengeluaran.js` |
| **T-013** | Halaman kasbon | Coder B | T-009, T-006 | `public/kasbon.html`, `public/js/kasbon.js` |
| **T-014** | Halaman riwayat | Coder B | T-009, T-007 | `public/riwayat.html`, `public/js/riwayat.js` |
| **T-015** | Halaman setting + backup UI | Coder B | T-009, T-008 | `public/setting.html`, `public/js/setting.js` |
| **T-016** | PWA: `manifest.json` + `sw.js` (cache-first aset) | Coder B | T-010–T-015 | `public/manifest.json`, `public/sw.js` |
| **T-017** | Test API (script otomatis) | Tester | T-004–T-008 | `tests/api/*.test.js`, laporan |
| **T-018** | Test UI + viewport mobile | Tester | T-010–T-015 | Checklist UI, laporan |
| **T-019** | Test integrasi E2E | Tester | T-017, T-018 | Laporan E2E |
| **T-020** | Test PWA + offline graceful | Tester | T-016 | Laporan PWA |
| **T-021** | Final integration, README, cleanup | Supervisor | T-019, T-020, G5 | `README.md`, tag release |

### 2.7 Definition of Done (per Task)

Setiap task dianggap **selesai** hanya jika semua item di bawah terpenuhi:

**Umum (semua Coder tasks):**
- [ ] Hanya mengubah file dalam ownership task
- [ ] Tidak menambah fitur di luar PRD §4–§5
- [ ] `npm start` tetap jalan setelah perubahan
- [ ] Response API mengikuti format §10.1

**T-000 (Architect):**
- [ ] Setiap endpoint punya request body, response success, response error
- [ ] Aturan validasi tertulis eksplisit per field
- [ ] Konvensi tanggal, mata uang, status kasbon terdokumentasi

**T-004 s/d T-008 (API):**
- [ ] GET, POST, DELETE sesuai contract
- [ ] Validasi: field wajib, angka > 0, ID tidak ditemukan → 404
- [ ] Test file di `tests/api/` untuk task tersebut hijau

**T-009 s/d T-015 (UI):**
- [ ] Touch target ≥ 56px
- [ ] Font body ≥ 16px, nominal ≥ 18px
- [ ] Konfirmasi dialog sebelum simpan/hapus
- [ ] Loading & error state ditampilkan ke user (Bahasa Indonesia)
- [ ] Bekerja di viewport 375px

**T-016 (PWA):**
- [ ] Aplikasi bisa di-add to home screen
- [ ] Aset statis load dari cache saat offline
- [ ] Banner/toast jelas saat offline: "Tidak ada koneksi"

**T-017 s/d T-020 (Tester):**
- [ ] Laporan bug memakai format §2.5
- [ ] Semua critical/high dari sprint sebelumnya re-tested setelah fix

### 2.8 Dependency Graph

```
T-000 (Contract) ─────────────────────────────────────────────┐
       │                                                       │
       ├──► T-001 (Setup) ──► T-002 (DB) ──► T-003 (Server) ─┼──► G2
       │                              │                       │
       │                              ├──► T-004 (API Pemasukan) ──┐
       │                              ├──► T-005 (API Pengeluaran) ─┤
       │                              ├──► T-006 (API Kasbon) ─────┤
       │                              ├──► T-008 (API Setting) ────┤
       │                              │                            │
       │                              └──► T-007 (API Ringkasan) ◄──┘
       │
       └──► T-009 (FE Shell) ──┬──► T-010 (Dashboard)
                               ├──► T-011 (Pemasukan)
                               ├──► T-012 (Pengeluaran)
                               ├──► T-013 (Kasbon)
                               ├──► T-014 (Riwayat)
                               └──► T-015 (Setting)
                                         │
                                         └──► T-016 (PWA)
                                                   │
                               T-017, T-018, T-019, T-020 (Testing)
                                                   │
                                               T-021 (Final)
```

---

## 3. Kondisi Pengguna

| Aspek | Kondisi |
|-------|---------|
| **Perangkat** | HP Android low-end (RAM 1-2GB, layar 5-6") |
| **Koneksi** | Maks 10 Mbps, sering putus-putus |
| **Literasi digital** | Dasar — bisa pakai WhatsApp, sosmed |
| **Kebutuhan utama** | Cepat, tidak ribet, tidak banyak klik |

> **Prinsip utama**: Setiap transaksi harus selesai dalam maksimal **3 tap** (buka form → isi → konfirmasi simpan).

---

## 4. Fitur yang TIDAK dibuat (Out of Scope)

Agent **wajib menolak** task yang menambah item berikut:

- ~~Manajemen produk / SKU / barcode~~
- ~~Manajemen stok / inventaris~~
- ~~Pencetakan struk thermal~~
- ~~Multi-user / role~~
- ~~Laporan grafik kompleks~~
- ~~Integrasi payment gateway~~
- ~~Multi-metode bayar~~
- ~~Sistem loyalitas / poin~~
- ~~Manajemen supplier~~
- ~~IndexedDB sync queue~~ (ditunda ke v3, lihat §11.3)

---

## 5. Fitur yang Dibuat

### 5.1 Pemasukan (Penjualan)

Catatan setiap kali uang masuk dari penjualan.

**Field:**
| Field | Tipe | Wajib | Validasi |
|-------|------|-------|----------|
| barang | text | Ya | 1–100 karakter |
| quantity | integer | Ya | ≥ 1 |
| harga | integer (Rp) | Ya | > 0 |
| catatan | text | Tidak | max 200 karakter |
| tanggal | datetime | Auto | default now, localtime |

**Aksi:**
- Tombol "Tambah Pemasukan" → form → konfirmasi → simpan
- Daftar pemasukan hari ini (default)
- Filter tanggal: hari ini / minggu ini / bulan ini / custom
- Total pemasukan di bagian atas
- Hapus dengan konfirmasi

### 5.2 Pengeluaran

**Field:**
| Field | Tipe | Wajib | Validasi |
|-------|------|-------|----------|
| keterangan | text | Ya | 1–100 karakter |
| nominal | integer (Rp) | Ya | > 0 |
| catatan | text | Tidak | max 200 karakter |
| tanggal | datetime | Auto | default now |

**Aksi:** sama pola dengan pemasukan.

### 5.3 Kasbon (Hutang Pelanggan)

**Field:**
| Field | Tipe | Wajib | Validasi |
|-------|------|-------|----------|
| nama | text | Ya | 1–50 karakter |
| nominal | integer (Rp) | Ya | > 0 |
| sisa | integer (Rp) | Auto | = nominal saat create |
| keterangan | text | Tidak | max 200 karakter |
| status | enum | Auto | `belum_lunas` / `lunas` |
| tanggal | datetime | Auto | default now |

**Aksi:**
- Tambah kasbon → `sisa = nominal`, `status = belum_lunas`
- Bayar: input nominal bayar → `sisa -= bayar` → jika `sisa <= 0` maka `status = lunas`, `sisa = 0`
- Validasi bayar: `0 < bayar <= sisa`
- Filter: belum lunas (default) / lunas / semua
- Total outstanding + jumlah orang di atas

### 5.4 Ringkasan Harian (Dashboard)

```
┌─────────────────────────────┐
│   WARUNG SUKMA              │  ← dari setting.nama_warung
│   Minggu, 19 Juni 2026     │
├─────────────────────────────┤
│  Pemasukan hari ini         │
│  Rp 1.250.000               │
│  Pengeluaran hari ini       │
│  Rp 350.000                 │
│  ─────────────────────      │
│  Sisa kas: Rp 900.000       │  ← pemasukan - pengeluaran (hari ini)
│  Kasbon belum lunas         │
│  Rp 275.000 (3 orang)       │
├─────────────────────────────┤
│  [+ Pemasukan]              │
│  [+ Pengeluaran]            │
│  [+ Kasbon]                 │
│  [Lihat Riwayat →]          │
└─────────────────────────────┘
```

---

## 6. Halaman & Navigasi

| Halaman | Route | Fungsi |
|---------|-------|--------|
| **Dashboard** | `/` | Ringkasan hari ini, aksi cepat |
| **Pemasukan** | `/pemasukan` | Form + daftar |
| **Pengeluaran** | `/pengeluaran` | Form + daftar |
| **Kasbon** | `/kasbon` | Form + daftar + bayar |
| **Riwayat** | `/riwayat` | Semua transaksi, filter tanggal |
| **Pengaturan** | `/setting` | Nama warung, backup |

**Bottom tab bar (5 item)** — Riwayat diakses dari Dashboard, bukan tab:

| Tab | Icon | Route |
|-----|------|-------|
| Beranda | home | `/` |
| Masuk | arrow-down-circle | `/pemasukan` |
| Keluar | arrow-up-circle | `/pengeluaran` |
| Kasbon | users | `/kasbon` |
| Atur | settings | `/setting` |

---

## 7. Stack Teknologi

| Komponen | Pilihan | Versi minimum |
|----------|---------|---------------|
| Runtime | Node.js | 18 LTS |
| Backend | Express | 4.x |
| Database | better-sqlite3 | 9.x |
| Frontend | Vanilla HTML/CSS/JS | — |
| CSS | Tailwind CSS CDN | 3.x |
| Icons | Lucide CDN | latest |
| Test | Node built-in test runner | Node 18+ |

**Scripts wajib di `package.json`:**
```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js",
    "test": "node --test tests/**/*.test.js",
    "db:init": "node db/init.js"
  }
}
```

---

## 8. Spesifikasi UI/UX

1. **Touch target** ≥ 56px
2. **Font** body ≥ 16px, nominal ≥ 18px bold
3. **Kontras tinggi** — teks gelap di background terang
4. **Input minimal** — tanggal auto, format ribuan saat ketik
5. **Konfirmasi** sebelum simpan dan hapus
6. **Bahasa UI** — Indonesia semua label & pesan error

**Format angka:**
```
Input user:  125000
Ke server:   125000 (integer, tanpa desimal)
Display:     Rp 125.000
```
Gunakan `Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })`.

---

## 9. Database Schema

```sql
-- Pemasukan
CREATE TABLE pemasukan (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  barang     TEXT NOT NULL,
  quantity   INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  harga      INTEGER NOT NULL CHECK (harga > 0),
  total      INTEGER GENERATED ALWAYS AS (quantity * harga) STORED,
  catatan    TEXT,
  tanggal    TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Pengeluaran
CREATE TABLE pengeluaran (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  keterangan TEXT NOT NULL,
  nominal    INTEGER NOT NULL CHECK (nominal > 0),
  catatan    TEXT,
  tanggal    TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Kasbon
CREATE TABLE kasbon (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  nama       TEXT NOT NULL,
  nominal    INTEGER NOT NULL CHECK (nominal > 0),
  sisa       INTEGER NOT NULL CHECK (sisa >= 0),
  keterangan TEXT,
  status     TEXT NOT NULL DEFAULT 'belum_lunas' CHECK (status IN ('belum_lunas', 'lunas')),
  tanggal    TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Pembayaran Kasbon
CREATE TABLE kasbon_bayar (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  kasbon_id  INTEGER NOT NULL REFERENCES kasbon(id) ON DELETE CASCADE,
  bayar      INTEGER NOT NULL CHECK (bayar > 0),
  tanggal    TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Pengaturan (key-value)
CREATE TABLE setting (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

**Seed default (`db/init.js`):**
```sql
INSERT OR IGNORE INTO setting (key, value) VALUES
  ('nama_warung', 'Warung Saya'),
  ('timezone', 'Asia/Jakarta');
```

---

## 10. API Contract

### 10.1 Format Response Standar

**Success:**
```json
{ "success": true, "data": {}, "message": null }
```

**Error:**
```json
{ "success": false, "data": null, "message": "Keterangan wajib diisi" }
```

| HTTP | Kondisi |
|------|---------|
| 200 | Sukses GET/POST/DELETE |
| 400 | Validasi gagal |
| 404 | ID tidak ditemukan |
| 500 | Error server (jangan expose stack trace ke client) |

### 10.2 Konvensi

| Item | Format |
|------|--------|
| Tanggal query `dari`/`sampai` | `YYYY-MM-DD` (inklusif) |
| Tanggal response | `YYYY-MM-DD HH:mm:ss` (localtime) |
| Mata uang | Integer Rupiah, tanpa desimal |
| Status kasbon | `belum_lunas` \| `lunas` |
| Default filter tanggal | Hari ini (00:00:00 – 23:59:59 local) |

### 10.3 Endpoints

#### Pemasukan
| Method | Endpoint | Body / Query |
|--------|----------|--------------|
| GET | `/api/pemasukan?dari=&sampai=` | Query opsional, default hari ini |
| POST | `/api/pemasukan` | `{ barang, quantity, harga, catatan? }` |
| DELETE | `/api/pemasukan/:id` | — |

**POST response `data`:** object pemasukan lengkap termasuk `id`, `total`, `tanggal`.

#### Pengeluaran
| Method | Endpoint | Body / Query |
|--------|----------|--------------|
| GET | `/api/pengeluaran?dari=&sampai=` | sama pola pemasukan |
| POST | `/api/pengeluaran` | `{ keterangan, nominal, catatan? }` |
| DELETE | `/api/pengeluaran/:id` | — |

#### Kasbon
| Method | Endpoint | Body / Query |
|--------|----------|--------------|
| GET | `/api/kasbon?status=belum_lunas` | `belum_lunas` (default) \| `lunas` \| `semua` |
| POST | `/api/kasbon` | `{ nama, nominal, keterangan? }` |
| POST | `/api/kasbon/:id/bayar` | `{ bayar }` |
| DELETE | `/api/kasbon/:id` | — |

**POST bayar response `data`:** `{ kasbon: {...}, pembayaran: {...} }`

#### Ringkasan & Riwayat
| Method | Endpoint | Response `data` |
|--------|----------|-------------------|
| GET | `/api/ringkasan` | `{ nama_warung, tanggal, pemasukan, pengeluaran, sisa_kas, kasbon_outstanding, kasbon_jumlah_orang }` |
| GET | `/api/riwayat?dari=&sampai=` | `{ items: [{ tipe, id, label, nominal, tanggal }] }` tipe: `pemasukan`\|`pengeluaran`\|`kasbon`\|`kasbon_bayar` |

**Contoh `/api/ringkasan`:**
```json
{
  "success": true,
  "data": {
    "nama_warung": "Warung Sukma",
    "tanggal": "2026-06-19",
    "pemasukan": 1250000,
    "pengeluaran": 350000,
    "sisa_kas": 900000,
    "kasbon_outstanding": 275000,
    "kasbon_jumlah_orang": 3
  },
  "message": null
}
```

#### Setting & Backup
| Method | Endpoint | Body / Response |
|--------|----------|-----------------|
| GET | `/api/setting` | `{ nama_warung, timezone }` |
| PUT | `/api/setting` | `{ nama_warung }` — min 1 karakter |
| GET | `/api/backup` | File download `kasir-backup-YYYYMMDD.db` |

#### Health (untuk gate G2)
| Method | Endpoint | Response |
|--------|----------|----------|
| GET | `/api/health` | `{ status: "ok", db: "connected" }` |

> **Catatan Architect**: `docs/CONTRACT.md` harus menyalin §10 + menambah contoh error per endpoint. Tidak boleh menyimpang dari sini tanpa approve User (G0 revision).

---

## 11. Spesifikasi Teknis

### 11.1 Performa
| Target | Batas |
|--------|-------|
| HTML first load | < 100KB (tanpa gambar) |
| Load di 3G | < 3 detik |
| Respons tombol | < 200ms (UI feedback) |
| Total cached | < 500KB |

### 11.2 PWA (MVP v2 — wajib)
- `manifest.json` — `name`, `short_name`, `start_url: "/"`, `display: standalone`, theme color
- Service Worker — **cache-first** untuk HTML, CSS, JS, CDN assets
- Installable ke home screen
- Saat offline: UI tetap navigable, form tidak submit, tampilkan pesan

### 11.3 Offline Data (v3 — TIDAK di MVP)
IndexedDB queue + background sync **ditunda** ke versi berikutnya. Agent tidak implement kecuali User explicitly revokes §4 out-of-scope.

**MVP offline behavior yang diharapkan:**
```
Online:  Browser → fetch /api → SQLite
Offline: Browser → SW cache (UI) + toast "Tidak ada koneksi, data tidak tersimpan"
```

---

## 12. Pengaturan Toko

| Setting | Key DB | Default | Keterangan |
|---------|--------|---------|------------|
| Nama warung | `nama_warung` | `Warung Saya` | Tampil di dashboard |
| Timezone | `timezone` | `Asia/Jakarta` | Untuk filter "hari ini" |

**Logo**: Out of scope v2 (hapus dari MVP untuk kurangi ambiguity).

**Backup**: Tombol di `/setting` → `GET /api/backup` → download file `.db`.

---

## 13. Struktur Proyek

```
kasir-mini/
├── docs/
│   └── CONTRACT.md        # T-000: API contract (Architect)
├── server.js              # T-003: Coder A
├── package.json           # T-001
├── README.md              # T-021
├── db/
│   ├── init.js            # T-002
│   └── kasir.db           # generated
├── routes/
│   ├── pemasukan.js       # T-004
│   ├── pengeluaran.js     # T-005
│   ├── kasbon.js          # T-006
│   ├── ringkasan.js       # T-007
│   └── setting.js         # T-008
├── tests/
│   └── api/               # T-017
├── public/
│   ├── index.html         # T-010
│   ├── pemasukan.html     # T-011
│   ├── pengeluaran.html   # T-012
│   ├── kasbon.html        # T-013
│   ├── riwayat.html       # T-014
│   ├── setting.html       # T-015
│   ├── css/style.css      # T-009
│   ├── js/
│   │   ├── app.js         # T-009 shared
│   │   ├── pemasukan.js
│   │   ├── pengeluaran.js
│   │   ├── kasbon.js
│   │   ├── riwayat.js
│   │   └── setting.js
│   ├── manifest.json      # T-016
│   └── sw.js
└── prd2.md
```

---

## 14. Milestone (Sprint Mapping)

| Sprint | Hari | Tasks | Gate |
|--------|------|-------|------|
| **S0** | 1 | T-000 | G1 |
| **S1** | 1-2 | T-001, T-002, T-003, T-009 | G2 |
| **S2** | 2-4 | T-004–T-008 (A) ∥ T-010–T-015 (B) | G3, G4 |
| **S3** | 4-5 | T-016, T-017–T-020 | G5 |
| **S4** | 5-6 | T-021 + bugfix | G6 |

---

## 15. Instruksi Agent (Prompt Seed)

### Supervisor
```
Anda Scrum Master + Tech Lead koordinator.
- Pecah work ke T-xxx, enforce gate G0–G6.
- Jangan assign task jika dependency belum completed.
- Saat merge: cek file ownership §2.4.
- Retry max 3x per bug sebelum escalate ke User.
- Deliverable akhir: app running + README + semua gate hijau.
```

### Architect
```
Anda Tech Lead. Output HANYA docs/CONTRACT.md.
- Salin §9–§10 dari PRD, tambah contoh request/response tiap endpoint.
- Tambah matriks validasi per field.
- Jangan tulis kode production.
- Selesai = Supervisor approve G1.
```

### Coder A (Backend)
```
Implementasi T-001–T-008. Owner: server.js, db/, routes/.
- better-sqlite3 synchronous.
- Validasi di route layer, pesan error Bahasa Indonesia.
- Response WAJIB { success, data, message }.
- Tulis test di tests/api/ untuk setiap route file.
```

### Coder B (Frontend)
```
Implementasi T-009–T-016. Owner: public/**.
- Vanilla JS, Tailwind CDN, Lucide CDN.
- app.js: apiFetch(), formatRupiah(), showToast(), confirmDialog(), initNav().
- Setiap halaman: loading state, error state, empty state.
- Jangan fetch langsung tanpa apiFetch wrapper.
```

### Tester
```
Implementasi T-017–T-020. Owner: tests/**.
- Buat test otomatis API (node --test).
- UI: checklist manual + screenshot opsional.
- E2E flow wajib: tambah pemasukan → cek dashboard → tambah kasbon → bayar partial → lunas.
- PWA: verify manifest valid, SW registers, offline shows toast.
- Jangan fix bug; lapor ke Supervisor dengan format §2.5.
```

---

## 16. Test Acceptance Criteria

### 16.1 API (T-017)
| # | Test | Expected |
|---|------|----------|
| A1 | POST pemasukan tanpa barang | 400, message Bahasa Indonesia |
| A2 | POST pemasukan harga -1 | 400 |
| A3 | GET pemasukan tanpa query | Data hari ini saja |
| A4 | DELETE pemasukan id 99999 | 404 |
| A5 | POST kasbon bayar > sisa | 400 |
| A6 | POST kasbon bayar = sisa | status `lunas`, sisa 0 |
| A7 | GET ringkasan | Semua field §10.3 ada, tipe number |
| A8 | PUT setting nama kosong | 400 |
| A9 | GET health | `{ status: "ok" }` |

### 16.2 UI (T-018)
| # | Test | Expected |
|---|------|----------|
| U1 | Viewport 375px | Tidak horizontal scroll |
| U2 | Tap target | Semua button ≥ 56px |
| U3 | Simpan pemasukan | Konfirmasi muncul sebelum submit |
| U4 | Dashboard | Sisa kas = pemasukan - pengeluaran |
| U5 | Kasbon default | Hanya belum lunas |
| U6 | Offline | Toast muncul, form tidak submit |

### 16.3 E2E (T-019)
```
1. Set nama warung "Toko Berkah"
2. Tambah pemasukan: Beras 2x 15000
3. Dashboard menampilkan pemasukan 30000
4. Tambah pengeluaran: Listrik 50000
5. Sisa kas = -20000 (tampilkan negatif jika perlu, jangan hide)
6. Tambah kasbon: Budi 100000
7. Bayar 40000 → sisa 60000, status belum_lunas
8. Bayar 60000 → status lunas
9. Riwayat menampilkan semua transaksi
10. Backup download file .db
```

---

## 17. Cara Pakai (User Akhir)

1. Buka browser HP → lihat ringkasan hari ini
2. Penjualan → tab Masuk → isi → konfirmasi → simpan
3. Pengeluaran → tab Keluar → isi → simpan
4. Hutang → tab Kasbon → tambah → bayar bertahap
5. Riwayat → dari Beranda tap "Lihat Riwayat"
6. Pengaturan → ganti nama warung + backup berkala

---

## 18. Changelog PRD

| Versi | Tanggal | Perubahan |
|-------|---------|-----------|
| 2.0 | 2026-06-19 | Draft awal multi-agent |
| 2.1 | 2026-06-20 | Agile mapping, gate, file ownership, DoD, API contract lengkap, fix nav 5 tab, setting API, scope offline v3, test criteria |

---

*PRD ini adalah kontrak kerja untuk agent AI. Jika ada ambiguitas, agent wajib escalate ke Supervisor/User — tidak boleh asumsi sendiri.*