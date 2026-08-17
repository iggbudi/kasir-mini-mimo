# Desain Penyempurnaan Stok di Master Barang

**Tanggal:** 2026-08-17
**Status:** Disetujui
**Cakupan:** Batas stok minimum global, filter kondisi stok, dan riwayat lengkap mutasi per barang

## Latar Belakang

Kasir Mini telah menyimpan stok pada `master_barang`. Kulakan menambah stok, penjualan mengurangi stok, pembatalan membalikkan perubahan, dan opname mengoreksi stok secara manual. Penjualan dan pembatalan kulakan boleh membuat stok bernilai minus.

Master Barang saat ini hanya membedakan stok habis. Pemilik warung membutuhkan cara untuk mengenali barang minus, habis, menipis, atau aman serta melihat penyebab perubahan stok tanpa berpindah dari Master Barang.

## Tujuan

1. Menyediakan satu batas stok minimum global yang dapat diatur dari Master Barang.
2. Mengelompokkan dan memfilter barang berdasarkan kondisi stok.
3. Mencatat semua mutasi stok baru secara atomik dan menampilkan riwayatnya per barang.
4. Mempertahankan seluruh kebijakan stok yang sudah berlaku, termasuk stok minus.

## Di Luar Cakupan

- Rekonstruksi mutasi dari transaksi lama.
- Batas minimum berbeda untuk setiap barang.
- Notifikasi stok pada dashboard.
- Halaman atau laporan riwayat stok global.
- Perubahan kebijakan penjualan saat stok tidak mencukupi.

## Keputusan Utama

- Batas minimum berlaku global untuk semua barang.
- Batas diatur langsung pada halaman Master Barang.
- Kondisi stok terdiri dari `minus`, `habis`, `menipis`, dan `aman`.
- Riwayat mencakup penjualan, kulakan, pembatalan penjualan, pembatalan kulakan, dan opname.
- Riwayat dibuka melalui tombol pada masing-masing barang.
- Ledger mulai mencatat sejak fitur baru dirilis; transaksi lama tidak direkonstruksi.
- Ledger khusus dipakai sebagai sumber riwayat, bukan query gabungan tabel transaksi dan bukan perluasan semantik `stok_adjustment`.

## Model Data

### Pengaturan batas minimum

Batas minimum disimpan pada tabel `setting`:

- key: `stok_minimum`
- value awal: `5`
- nilai valid: bilangan bulat minimal `1`

Penyimpanan sebagai setting mempertahankan satu sumber nilai global tanpa menambah kolom pada setiap barang.

### Ledger `stok_mutation`

Migration baru membuat tabel append-only dengan struktur konseptual berikut:

| Kolom | Fungsi |
|---|---|
| `id` | Primary key |
| `barang_id` | Barang yang stoknya berubah |
| `tipe` | `penjualan`, `kulakan`, `batal_penjualan`, `batal_kulakan`, atau `opname` |
| `perubahan` | Selisih bertanda: negatif untuk stok keluar dan positif untuk stok masuk; dapat `0` untuk opname tanpa selisih |
| `stok_sebelum` | Stok tepat sebelum mutasi |
| `stok_sesudah` | Stok tepat setelah mutasi |
| `referensi_id` | ID penjualan atau kulakan; `NULL` untuk opname |
| `catatan` | Alasan void atau catatan opname jika tersedia |
| `tanggal` | Waktu mutasi dalam format waktu yang digunakan aplikasi |

Indeks disediakan untuk `(barang_id, tanggal, id)` agar pengambilan riwayat terbaru per barang efisien. Indeks unik parsial pada `(tipe, referensi_id, barang_id)` saat `referensi_id` tidak `NULL` mencegah mutasi transaksi tercatat dua kali. `barang_id` tetap dapat menunjuk barang yang telah diarsipkan. Referensi transaksi bersifat polimorfik berdasarkan `tipe`, sehingga `referensi_id` tidak menggunakan foreign key langsung.

`stok_adjustment` lama tetap dipertahankan untuk kompatibilitas backup dan data opname historis. Mulai rilis baru, opname tetap menulis `stok_adjustment` seperti sekarang dan juga menulis `stok_mutation` sebagai ledger riwayat terpadu. Riwayat UI hanya membaca `stok_mutation`, sehingga opname lama tidak diklaim sebagai bagian ledger baru.

## Klasifikasi Kondisi Stok

Dengan batas minimum `M`:

| Kondisi | Aturan |
|---|---|
| `minus` | `stok < 0` |
| `habis` | `stok = 0` |
| `menipis` | `stok >= 1 AND stok <= M` |
| `aman` | `stok > M` |

Kondisi dihitung dari stok terkini dan nilai setting saat request dilakukan. Mengubah batas minimum langsung mengubah klasifikasi tanpa memutasi barang atau membuat entri ledger.

## API

### Daftar barang

`GET /api/barang` mempertahankan parameter yang ada dan menerima parameter opsional:

- `kondisi_stok=semua|minus|habis|menipis|aman`
- default: `semua`

Parameter ini dapat digabung dengan `status` dan `q`. Nilai tidak dikenal menghasilkan `400`. Setiap barang pada respons menyertakan `kondisi_stok`.

### Konfigurasi stok

- `GET /api/barang/stok-config`
- `PUT /api/barang/stok-config` dengan body `{ "stok_minimum": 5 }`

Endpoint GET mengembalikan nilai efektif. Endpoint PUT hanya menerima bilangan bulat minimal 1 dan menyimpan value ke tabel `setting`. Endpoint statis harus didaftarkan sebelum route parameter umum yang dapat menangkap path tersebut.

### Riwayat barang

`GET /api/barang/:id/mutasi?limit=20&offset=0`

Aturan:

- `id` harus ID positif dan barang harus ada.
- `limit` default 20 dan dibatasi maksimum yang wajar, yaitu 100.
- `offset` default 0 dan tidak boleh negatif.
- urutan `tanggal DESC, id DESC` menjamin hasil terbaru dan stabil.
- respons menyertakan daftar mutasi dan penanda apakah masih ada data agar UI dapat menampilkan tombol **Muat Lagi**.

Setiap entri memuat tipe, perubahan, stok sebelum/sesudah, tanggal, referensi transaksi, dan catatan. Nomor nota atau nomor kulakan diambil ketika riwayat dibaca berdasarkan `tipe` dan `referensi_id`; bila referensi tidak tersedia, UI tetap dapat menampilkan jenis mutasi dan ID referensi.

## Alur Penulisan Mutasi

Semua pembaruan stok dan ledger berada dalam write-transaction yang sama dengan transaksi bisnisnya.

### Penjualan

1. Validasi barang dan detail penjualan.
2. Agregasikan quantity berdasarkan `barang_id`.
3. Buat header penjualan untuk memperoleh ID referensi.
4. Untuk setiap barang, baca stok sebelum, hitung stok sesudah, perbarui stok, lalu tulis satu mutasi `penjualan` dengan ID penjualan tersebut.
5. Simpan detail dan selesaikan nomor nota dalam write-transaction yang sama.

Stok boleh menjadi minus. Baris barang yang berulang pada nota yang sama menghasilkan satu mutasi agregat.

### Kulakan

1. Validasi barang dan detail kulakan.
2. Agregasikan quantity berdasarkan `barang_id`.
3. Buat header kulakan untuk memperoleh ID referensi dan simpan detailnya.
4. Untuk setiap barang, tambah stok dan tulis satu mutasi `kulakan` dengan ID kulakan tersebut dalam write-transaction yang sama.

### Pembatalan

- Pembatalan penjualan menulis mutasi `batal_penjualan` dengan perubahan positif.
- Pembatalan kulakan menulis mutasi `batal_kulakan` dengan perubahan negatif.
- Quantity diagregasikan per barang.
- Alasan pembatalan disalin ke `catatan`.
- Request void kedua mengembalikan hasil idempoten dan tidak mengubah stok atau menulis mutasi lagi.

### Opname

1. Baca stok saat ini.
2. Hitung `perubahan = stok_sesudah - stok_sebelum`.
3. Pertahankan penulisan ke `stok_adjustment` untuk kompatibilitas.
4. Perbarui `master_barang.stok`.
5. Tulis mutasi `opname`, termasuk catatan opsional.

Opname ke nilai yang sama tetap dapat dicatat sebagai bukti pemeriksaan fisik dan memiliki `perubahan = 0`.

### Kegagalan atomik

Jika insert ledger gagal, perubahan stok dan transaksi penjualan, kulakan, pembatalan, atau opname ikut rollback. Tidak ada jalur yang boleh memperbarui stok tanpa menulis mutasi setelah fitur diaktifkan.

## Antarmuka Master Barang

### Kontrol daftar

Area pencarian ditambah:

- input angka **Batas stok minimum**;
- tombol **Simpan**;
- filter **Kondisi Stok** dengan pilihan Semua, Minus, Habis, Menipis, dan Aman.

Filter kondisi bekerja bersama pencarian nama serta filter status aktif/arsip. Menyimpan batas yang baru memuat ulang daftar supaya badge segera dihitung ulang.

### Kartu barang

Setiap kartu menampilkan angka stok dan tepat satu badge kondisi. Badge memiliki label dan gaya visual yang berbeda untuk Minus, Habis, Menipis, dan Aman. Tombol aksinya adalah:

- **Isi Stok**;
- **Riwayat Stok**;
- Edit dan Arsipkan untuk barang aktif; atau Aktifkan untuk barang arsip.

Alur **Isi Stok** meminta jumlah fisik terbaru dan catatan opsional, lalu mengirim keduanya ke endpoint opname yang sudah ada.

### Modal riwayat

Tombol **Riwayat Stok** membuka modal untuk barang terpilih. Setiap baris menampilkan:

- waktu;
- jenis sumber dan nomor referensi bila tersedia;
- perubahan bertanda;
- stok sebelum → stok sesudah;
- catatan bila tersedia.

Modal memuat 20 entri pertama. Tombol **Muat Lagi** mengambil halaman berikutnya dan menggabungkannya ke daftar. Jika ledger kosong, modal menjelaskan bahwa riwayat lengkap baru dicatat sejak pembaruan fitur.

## Penanganan Kesalahan

- Batas minimum kosong, desimal, atau kurang dari 1 menghasilkan `400` dan pesan validasi yang spesifik.
- Barang yang tidak ditemukan pada endpoint riwayat menghasilkan `404`.
- Filter, limit, atau offset yang tidak valid menghasilkan `400`.
- UI tidak mengganti nilai batas yang sedang aktif bila penyimpanan gagal dan menampilkan toast kesalahan.
- Modal menampilkan status gagal serta tombol coba lagi bila request riwayat gagal.
- Tombol simpan dan muat lagi dinonaktifkan selama request untuk mencegah pengiriman ganda.
- Daftar mempertahankan empty state yang jelas bila filter tidak menemukan barang.

## Pengujian

### Backend

1. Migration membuat tabel dan indeks secara idempoten serta tidak mengubah stok yang ada.
2. Konfigurasi mengembalikan default 5, dapat disimpan, dan menolak nilai tidak valid.
3. Klasifikasi diuji untuk stok negatif, nol, tepat 1, tepat batas, dan di atas batas.
4. Kombinasi `status`, `q`, dan `kondisi_stok` menghasilkan daftar yang benar.
5. Penjualan menulis mutasi negatif dengan stok sebelum/sesudah yang benar.
6. Kulakan menulis mutasi positif dengan stok sebelum/sesudah yang benar.
7. Kedua jenis void menulis mutasi kebalikan dan menyimpan alasan.
8. Opname menulis ledger dan `stok_adjustment`, termasuk selisih nol.
9. Item duplikat dalam satu transaksi menghasilkan satu mutasi per barang.
10. Void kedua tidak menghasilkan mutasi tambahan.
11. Simulasi kegagalan insert ledger membuktikan transaksi dan perubahan stok rollback.
12. Riwayat menguji urutan stabil, pagination, referensi, barang tidak ditemukan, dan validasi parameter.

### Frontend

1. Filter kondisi mengirim parameter API yang benar dan dapat digabung dengan filter lain.
2. Badge sesuai dengan `kondisi_stok` dari API.
3. Menyimpan batas memuat ulang daftar dan menangani kegagalan tanpa menampilkan nilai palsu.
4. Modal menampilkan semua atribut mutasi dan empty state.
5. **Muat Lagi** menggabungkan halaman tanpa menduplikasi entri.
6. Opname mengirim jumlah dan catatan opsional.

### Regresi

Seluruh test penjualan, kulakan, void, opname, backup/restore, dan Master Barang yang sudah ada harus tetap lulus. Backup dan restore harus menyertakan tabel ledger serta setting baru, dan restore backup lama harus tetap berhasil melalui migration idempoten.

## Definisi Selesai

- Pengguna dapat mengatur satu batas minimum global dari Master Barang.
- Barang dapat difilter dan diberi badge Minus, Habis, Menipis, atau Aman.
- Semua perubahan stok baru memiliki ledger atomik dengan sumber yang dapat ditelusuri.
- Riwayat per barang dapat dibuka dan dipaginasi dari Master Barang.
- Data dan stok lama tidak berubah saat migration.
- Tidak ada perubahan pada kebijakan stok minus.
- Pengujian baru dan seluruh pengujian regresi lulus.
