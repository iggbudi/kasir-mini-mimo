# Sprint 3 Plan — Transaksi Inti

**Status:** Planning  
**Gate Target:** API transaksi dan UI transaksi utama lolos test.  
**Based on:** `sprint.md` (Sprint 3) + `prd2.md` (detailed specs)

## Tujuan

Membuat fitur kasir utama: pencatatan pemasukan (penjualan), pengeluaran, dan kasbon (hutang pelanggan) beserta UI-nya.

Setelah sprint ini, pengguna bisa:
- Mencatat transaksi masuk/keluar/kasbon
- Melihat daftar dengan filter tanggal/status
- Melakukan pembayaran kasbon bertahap

## Scope (KETAT sesuai sprint.md)

### In Scope
**Backend:**
- `routes/pemasukan.js`
  - GET `/api/pemasukan?dari=&sampai=` (default hari ini)
  - POST `/api/pemasukan`
  - DELETE `/api/pemasukan/:id`
- `routes/pengeluaran.js` (pola sama)
- `routes/kasbon.js`
  - GET `/api/kasbon?status=`
  - POST `/api/kasbon`
  - POST `/api/kasbon/:id/bayar`
  - DELETE `/api/kasbon/:id`
- Mount semua route di `server.js` dengan `requireAuth`
- Gunakan `utils/validate.js` (extend jika perlu)
- Business logic kasbon (update sisa + status, insert bayar)
- Test file masing-masing: `tests/api/pemasukan.test.js`, dll.

**Frontend:**
- Halaman mandiri:
  - `public/pemasukan.html` + `public/js/pemasukan.js`
  - `public/pengeluaran.html` + `public/js/pengeluaran.js`
  - `public/kasbon.html` + `public/js/kasbon.js`
- Shared di `public/js/app.js`:
  - `showToast(message, type = 'success' | 'error')`
  - `confirmDialog(message)` → Promise<boolean>
  - Loading / error / empty state helpers (via CSS + JS)
- Setiap halaman:
  - Form tambah + validasi client + konfirmasi sebelum submit
  - Daftar data (default hari ini / filter status untuk kasbon)
  - Total / summary di atas
  - Hapus dengan konfirmasi
  - Filter tanggal sederhana (hari ini / custom via input date, atau buttons)
- Update `public/index.html` dengan quick links ke halaman transaksi + tombol cepat (tetap sederhana, bukan full dashboard)

**UI & CSS:**
- Extend `public/css/style.css` untuk:
  - List items
  - Form fields lebih baik
  - Totals / summary cards
  - Toast notification
  - Simple modal atau inline confirm
  - Filter buttons / date inputs
  - Responsive mobile-first (max 480px)

**Lainnya:**
- Semua pesan error dalam Bahasa Indonesia
- Response API wajib `{ success, data, message }`
- Validasi server-side ketat (wajib, >0, dll)
- Semua halaman protected (redirect ke login jika tidak auth via apiFetch)

### Out of Scope (Sprint 4+)
- Ringkasan dashboard lengkap + sisa kas + kasbon outstanding (Sprint 4)
- Halaman riwayat lengkap
- Setting lengkap + backup
- Bottom tab bar 5 item
- PWA (manifest, sw)
- Filter lanjutan (minggu/bulan)
- Riwayat gabungan
- Cetak struk

## Deliverables

| Kategori | File | Deskripsi |
|----------|------|-----------|
| Routes | `routes/pemasukan.js` | CRUD dasar pemasukan |
| Routes | `routes/pengeluaran.js` | CRUD dasar pengeluaran |
| Routes | `routes/kasbon.js` | Kasbon + bayar logic |
| Server | `server.js` | Mount 3 route baru |
| Frontend | `public/pemasukan.html` + `js/pemasukan.js` | Halaman pemasukan |
| Frontend | `public/pengeluaran.html` + `js/pengeluaran.js` | Halaman pengeluaran |
| Frontend | `public/kasbon.html` + `js/kasbon.js` | Halaman kasbon + bayar |
| Shared | `public/js/app.js` | Tambah toast + confirmDialog |
| CSS | `public/css/style.css` | Tambahan komponen transaksi |
| Tests | `tests/api/pemasukan.test.js` dll | 5+ test per modul |
| Index | `public/index.html` | Tambah link navigasi sederhana |

## Rincian Backend

### Validasi (reuse/extend `utils/validate.js`)
- `requireString(val, 'Barang')` → 1-100 char
- `requirePositiveInteger(val, 'Harga')`
- Untuk kasbon bayar: `bayar > 0 && bayar <= sisa`

### Pemasukan & Pengeluaran (pola hampir sama)
**GET /api/xxx?dari=YYYY-MM-DD&sampai=YYYY-MM-DD**
- Default: hari ini (gunakan `date('now', 'localtime')` atau hitung string)
- Return array record + mungkin total terpisah di data atau client hitung
- Sort by tanggal DESC

**POST**
- Validasi semua field wajib sesuai matriks
- Simpan, return record lengkap (termasuk `id`, `total` untuk pemasukan, `tanggal`)

**DELETE /:id**
- Cek exists → 404 jika tidak
- Hapus

### Kasbon Khusus
**POST /api/kasbon**
- `sisa = nominal`, `status = 'belum_lunas'`

**POST /api/kasbon/:id/bayar**
- Ambil kasbon, validasi `belum_lunas`, `0 < bayar <= sisa`
- UPDATE sisa dan status
- INSERT ke `kasbon_bayar`
- Gunakan `db.transaction()` untuk atomicity
- Return `{ kasbon, pembayaran }`

**GET /api/kasbon?status=belum_lunas|lunas|semua**
- Filter sesuai

## Rincian Frontend

### Shared (app.js)
Tambahkan:
```js
function showToast(message, type = 'success') { ... }  // bottom toast, auto hide
function confirmDialog(message) { return new Promise(...) } // gunakan native confirm dulu atau custom div
// Helper: showLoading(el), showError(el, msg), showEmpty(el, msg)
```

### Pola Halaman (setiap .html)
- Header dengan nama warung + logout
- Section: Form tambah (gunakan input + label)
- Section: Summary total
- Section: Filter (button "Hari Ini", input date range sederhana)
- List: card atau baris dengan data + tombol hapus/bayar
- Gunakan `apiFetch`
- Loading state saat fetch
- Error state
- Setelah aksi sukses: refresh list + toast

**Pemasukan specific:**
- Input: barang (text), quantity (number), harga (number), catatan (optional)
- List tampilkan: barang x qty @ harga = total
- Sum total pemasukan

**Pengeluaran:**
- Mirip, keterangan + nominal

**Kasbon:**
- Tambah: nama, nominal, keterangan
- List: nama, nominal, sisa, status badge
- Tombol "Bayar" → prompt/input nominal → POST bayar
- Validasi client + server untuk bayar
- Filter status (default belum_lunas)

**Navigasi antar halaman:**
- Link sederhana di header: Beranda | Pemasukan | Pengeluaran | Kasbon
- Atau tombol kembali ke `/`

## CSS Extensions (style.css)

Tambahkan:
- `.list`, `.list-item`
- `.summary`, `.total`
- `.filter-bar`, `.btn-filter`
- `.toast`
- `.badge` (untuk status)
- `.form-row`, `.actions`
- Responsive tweaks

Gunakan warna konsisten (hijau untuk pemasukan, merah untuk keluar)

## Testing

Ikuti acceptance criteria dari prd2.md §16:

**API Tests (per route):**
- Validasi wajib → 400 Bahasa Indonesia
- Angka negatif / 0 → 400
- GET tanpa query → data hari ini saja
- DELETE ID tidak ada → 404
- Kasbon bayar > sisa → 400
- Bayar = sisa → status lunas + sisa=0

**UI manual (nantinya oleh tester):**
- Viewport 375px
- Konfirmasi sebelum simpan
- Toast muncul

## Urutan Implementasi Disarankan

1. **Backend dulu (stabilisasi data)**
   - Buat `routes/pemasukan.js`
   - Update `server.js` (mount + test)
   - Buat test `tests/api/pemasukan.test.js`
   - Ulangi untuk pengeluaran
   - Kasbon (paling kompleks, lakukan terakhir backend)

2. **Shared JS & CSS**
   - Update `app.js` (toast + confirm)
   - Extend `style.css`

3. **Frontend Pages** (bisa parallel setelah backend siap)
   - pemasukan.html + js
   - pengeluaran
   - kasbon (termasuk bayar UI)

4. **Integrasi & Polish**
   - Update `public/index.html` dengan quick links
   - Tambah navigasi antar halaman
   - End-to-end manual test dasar
   - Full `npm test`

5. **Verifikasi Gate**
   - Jalankan semua test
   - Manual flow: tambah → lihat list → bayar kasbon → hapus
   - Pastikan auth tetap bekerja
   - Mobile viewport check

## Pertimbangan Teknis & Risiko

- **Tanggal filter:** Konsisten gunakan `YYYY-MM-DD`. Di backend gunakan `WHERE date(tanggal) BETWEEN ? AND ?`
- **Kasbon bayar atomic:** Wajib pakai `db.transaction()`
- **Total pemasukan:** Bisa hitung di client (lebih sederhana) atau query SUM
- **Form UX:** Hindari submit ganda → disable button saat loading
- **Error handling:** Selalu tangkap di apiFetch, tampilkan toast
- **Tidak pakai framework:** Pure vanilla + fetch. Gunakan `dataset` untuk id di DOM
- **Scope creep:** Jangan tambahkan ringkasan atau riwayat di sprint ini

## Gate Checklist

- [ ] 3 route files + tests lolos
- [ ] 3 halaman HTML/JS berfungsi penuh
- [ ] Validasi server + client
- [ ] Kasbon bayar logic benar (termasuk status)
- [ ] Toast + confirmDialog berfungsi
- [ ] Semua halaman protected auth
- [ ] `npm test` hijau
- [ ] `npm start` jalan tanpa error
- [ ] Manual test di HP simulator (375px)

## Progress

Lihat `sprint.md` dan gunakan todo untuk tracking implementasi.

---

**Catatan:** Plan ini mengikuti pembagian sprint di `sprint.md`. Beberapa elemen (seperti ringkasan) sengaja ditunda ke Sprint 4 sesuai dokumen.

Dibuat berdasarkan analisis codebase setelah Sprint 2 + PRD.
