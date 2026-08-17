# Panduan Fitur Stok — Kasir Mini

Panduan singkat untuk pemilik/kasir. Fitur stok mulai berlaku setelah aplikasi di-update ke versi dengan stok.

---

## 1. Atur Batas dan Isi Stok Awal

Buka **Atur → Master Barang**. Pada bagian **Batas Stok Minimum**, masukkan bilangan bulat minimal 1 lalu tekan **Simpan**. Nilai awalnya 5 dan berlaku global untuk semua barang.

Daftar dapat difilter lewat **Kondisi Stok**: Semua, **Minus**, Habis, **Menipis**, dan Aman. Filter ini dapat dipakai bersama pencarian nama serta status aktif/arsip.

Stok yang sudah ada **dipertahankan** saat pembaruan v9—pembaruan ini tidak mengosongkan stok. Hanya saat fitur pelacakan stok diaktifkan untuk pertama kalinya, produk lama yang belum pernah memiliki angka stok dimulai dari 0. Ledger riwayat terpadu juga mulai kosong dan tidak merekonstruksi transaksi lama.

1. Buka menu **Atur → Master Barang** (atau menu Master Barang dari Beranda).
2. Di setiap barang, tekan **Isi Stok**.
3. Ketik jumlah stok fisik yang benar-benar ada sekarang, lalu **Simpan**.
4. Ulangi untuk semua barang yang mau dijual.

> Tips: lakukan ini sekali saja saat pertama kali. Setelah itu stok jalan otomatis mengikuti transaksi.

---

## 2. Jualan (Penjualan)

- Saat mencari barang, **stok tersedia** ikut terlihat (contoh: "Gula 1kg — Rp17.500 · Stok 12").
- Penjualan yang tersimpan **mengurangi stok otomatis**. Jika jumlah penjualan melebihi stok, stok boleh menjadi **minus**; ini bukan error.
- Badge pada kartu membantu membaca kondisi: **Minus** berarti stok < 0, **Habis** berarti 0, **Menipis** berarti 1 sampai batas minimum, dan **Aman** berarti di atas batas minimum.

---

## 3. Kulakan (Belanja dari Salesman)

- Saat memilih barang di form kulakan, **stok saat ini** ikut tampil (mis. "Beras 5kg (stok 3)") — biar tahu harus beli berapa.
- Setelah kulakan disimpan, **stok bertambah otomatis** sesuai jumlah beli.
- Tidak perlu isi stok manual setelah kulakan.

---

## 4. Membatalkan Transaksi (Void)

| Yang dibatalkan | Efek ke stok |
|---|---|
| **Penjualan** (tombol Batalkan di halaman Jual) | Stok barang **kembali** seperti sebelum dijual |
| **Kulakan** (tombol Batalkan di halaman Kulakan) | Stok barang **berkurang** lagi (pembelian dianggap batal) |

> ⚠️ Jika kulakan dibatalkan padahal barangnya sudah terjual, stok bisa menjadi **minus** (mis. -3). Ini wajar dan tidak merusak data — perbaiki dengan Isi Stok.

---

## 5. Kapan Harus Isi Stok Lagi

Isi Stok (opname) dipakai untuk **memperbaiki** angka stok, misalnya:

- **Selisih stok** — ternyata barang di rak berbeda dari catatan (pecah, hilang, salah hitung).
- **Stok minus** — akibat membatalkan kulakan yang barangnya sudah laku.
- **Awal barang baru** — barang lama yang pernah diarsipkan lalu diaktifkan kembali (stoknya mulai dari angka lama; set ulang jika perlu).

Cara: **Master Barang → Isi Stok** pada barang tersebut → ketik angka stok fisik terbaru → Simpan. Setiap kali Isi Stok, aplikasi menyimpan riwayat perubahan.

Untuk melihatnya, tekan **Riwayat Stok** pada kartu barang. Riwayat menampilkan waktu, jenis mutasi, nomor referensi bila tersedia, perubahan, stok sebelum → sesudah, dan catatan. Gunakan **Muat Lagi** untuk mengambil halaman berikutnya.

Riwayat lengkap mulai dicatat setelah pembaruan fitur ini; data transaksi lama tidak direkonstruksi menjadi riwayat mutasi.

---

## 6. Catatan Penting

- **Transaksi lama** (sebelum fitur stok aktif) **tidak** direkonstruksi ke ledger. Stok yang sudah tersimpan dipertahankan; hanya produk yang pertama kali diaktifkan untuk pelacakan stok yang dimulai dari 0.
- Stok dapat minus dari **penjualan** atau pembatalan kulakan. Opname tetap hanya menerima angka minimal 0.
- Backup otomatis menyertakan data stok dan riwayat opname — aman untuk pindah perangkat.

---

## Ringkasan Satu Kalimat

> **Kulakan = stok naik · Jualan = stok turun · Batalkan = dibalik · Isi Stok = perbaiki angka manual.**
