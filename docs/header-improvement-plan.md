# Header Improvement Plan

## Tujuan

Meningkatkan header dashboard setelah login agar lebih informatif, ramah untuk pengguna warung, dan mengurangi risiko salah tap tombol logout.

## Scope

Diubah:

- Header dashboard `/` (`public/index.html`)
- Styling header dashboard (`public/css/style.css`)
- Status koneksi online/offline
- Posisi tombol logout
- Cache version service worker

Tidak diubah:

- API backend
- Database schema
- Auth/session backend
- Halaman transaksi lain

## Desain Target

```text
┌─────────────────────────────┐
│ Warung Saya           Keluar│
│ Selamat pagi, admin          │
│ Rabu, 24 Juni 2026 · 13:45  │
│                             │
│ Sisa kas hari ini           │
│ Rp 125.000                  │
│ Masuk Rp 500rb · Keluar Rp375rb │
│ ● Online                    │
└─────────────────────────────┘
```

## Tasks

### H-001 — Update Struktur Header Dashboard

File:

- `public/index.html`

Perubahan:

- Header menampilkan nama warung.
- Tombol kecil `Keluar` di kanan atas.
- Greeting: `Selamat pagi/siang/sore/malam, admin`.
- Tanggal dan jam Asia/Jakarta.
- Highlight `Sisa kas hari ini`.
- Ringkasan kecil pemasukan dan pengeluaran.
- Status koneksi.

Acceptance criteria:

- Logout tidak lagi berupa tombol besar di bawah dashboard.
- Sisa kas menjadi angka utama.
- Header nyaman di viewport 375px.

### H-002 — Update Logic Dashboard

File:

- `public/index.html`

Perubahan:

- Ambil data dari:
  - `GET /api/auth/me`
  - `GET /api/setting`
  - `GET /api/ringkasan`
- Isi elemen header dari response API.
- Jika API gagal, UI tetap tampil dengan fallback `-`.

Acceptance criteria:

- Greeting muncul setelah login.
- Nama warung tampil.
- Sisa kas, pemasukan, dan pengeluaran tampil jika API sukses.
- Dashboard tidak blank jika salah satu API gagal.

### H-003 — Status Koneksi Online/Offline

File:

- `public/index.html`
- `public/css/style.css`

Perubahan:

- Status tampil sebagai:
  - `● Online`
  - `● Tidak ada koneksi`
- Status berubah saat event `online` dan `offline`.

Acceptance criteria:

- Online berwarna hijau.
- Offline berwarna merah/oranye.
- Tidak merusak layout mobile.

### H-004 — Update CSS Header

File:

- `public/css/style.css`

Class baru/diubah:

- `.dashboard-hero`
- `.dashboard-hero__top`
- `.dashboard-hero__warung`
- `.dashboard-hero__logout`
- `.dashboard-hero__greeting`
- `.dashboard-hero__datetime`
- `.dashboard-hero__cash-label`
- `.dashboard-hero__cash-value`
- `.dashboard-hero__mini-summary`
- `.connection-status`
- `.connection-status.online`
- `.connection-status.offline`

Acceptance criteria:

- Mobile-first.
- Tidak horizontal scroll di 375px.
- Tombol logout minimal 44px tinggi.
- Angka sisa kas minimal 24px dan bold.
- Kontras tinggi.

### H-005 — Hapus Logout Besar di Bawah Dashboard

File:

- `public/index.html`

Perubahan:

- Hapus tombol besar `Keluar` dari bawah menu.
- Logout hanya tersedia di header.

Acceptance criteria:

- Tidak ada dua tombol logout.
- Risiko salah tap logout berkurang.

### H-006 — Cache Bust PWA

File:

- `public/sw.js`

Perubahan:

- Naikkan cache version ke versi berikutnya.

Acceptance criteria:

- Asset dashboard terbaru dipakai setelah redeploy/refresh.

## Testing Checklist

### Desktop

- [ ] Login berhasil.
- [ ] Dashboard tampil.
- [ ] Nama warung benar.
- [ ] Greeting muncul.
- [ ] Tanggal dan jam berjalan.
- [ ] Sisa kas tampil.
- [ ] Masuk/keluar tampil.
- [ ] Status koneksi Online.
- [ ] Klik Keluar kembali ke login.

### Mobile 375px

- [ ] Tidak ada horizontal scroll.
- [ ] Header tidak terlalu tinggi.
- [ ] Tombol Keluar mudah ditap tapi tidak dominan.
- [ ] Bottom nav tidak menutupi konten.
- [ ] Angka sisa kas mudah dibaca.

### Offline

- [ ] Status berubah ke `Tidak ada koneksi`.
- [ ] Toast offline tetap muncul.
- [ ] UI tidak crash.
