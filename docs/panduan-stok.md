# Panduan Fitur Stok — Kasir Mini

Panduan singkat untuk pemilik/kasir. Fitur stok mulai berlaku setelah aplikasi di-update ke versi dengan stok.

---

## 1. Pertama Kali Pakai: Isi Stok Awal

Setelah update, **stok semua barang = 0**. Aplikasi tidak tahu stok lama di warung.

1. Buka menu **Atur → Master Barang** (atau menu Master Barang dari Beranda).
2. Di setiap barang, tekan **Isi Stok**.
3. Ketik jumlah stok fisik yang benar-benar ada sekarang, lalu **Simpan**.
4. Ulangi untuk semua barang yang mau dijual.

> Tips: lakukan ini sekali saja saat pertama kali. Setelah itu stok jalan otomatis mengikuti transaksi.

---

## 2. Jualan (Penjualan)

- Saat mencari barang, **stok saat ini** ikut terlihat (contoh: "Gula 1kg — Rp17.500 · Stok 12").
- Penjualan tetap bisa dicatat meskipun jumlah melebihi stok saat ini atau stok bernilai 0.
- Jika penjualan melebihi stok, stok akan menjadi minus. Contoh: stok 2 dan terjual 5, maka stok menjadi -3.
- Ini berguna untuk kasus barang sudah terjual tetapi kulakan atau stok fisiknya belum sempat dicatat.
- Setiap penjualan yang tersimpan **mengurangi stok otomatis**.

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
- **Stok minus** — akibat penjualan sebelum stok dicatat, atau pembatalan kulakan setelah barangnya sudah laku.
- **Awal barang baru** — barang lama yang pernah diarsipkan lalu diaktifkan kembali (stoknya mulai dari angka lama; set ulang jika perlu).

Cara: **Master Barang → Isi Stok** pada barang tersebut → ketik angka stok fisik terbaru → (opsional) isi catatan → Simpan. Setiap kali Isi Stok, aplikasi menyimpan **riwayat perubahannya** — lihat tombol **Riwayat Stok** di samping Isi Stok.

---

## 6. Batas Stok Minimum

Di halaman **Master Barang**, kolom **Batas Stok Minimum** (awal: 5) menentukan kapan stok dianggap **Menipis**:

- Tekan **Simpan** setelah mengubah angkanya.
- Batas berlaku global untuk semua barang.
- Stok **Minus** (di bawah 0), **Habis** (0), **Menipis** (1 sampai batas), dan **Aman** (di atas batas) ditandai dengan badge berwarna di setiap barang.

## 7. Filter Kondisi Stok

Di halaman Master Barang, filter **Kondisi Stok** memilih barang berdasarkan kondisinya: **Semua**, **Minus**, **Habis**, **Menipis**, atau **Aman**. Filter ini bisa digabung dengan pencarian nama dan filter status Aktif/Diarsipkan.

## 8. Riwayat Stok

Tombol **Riwayat Stok** pada setiap barang membuka modal berisi mutasi stok terbaru dahulu (20 entri per halaman; tekan **Muat Lagi** untuk halaman berikutnya). Setiap baris menampilkan:

- **Jenis mutasi**: Penjualan, Kulakan, Batal Penjualan, Batal Kulakan, atau Opname;
- **Nomor nota/kulakan** bila mutasi berasal dari transaksi;
- **Perubahan** bertanda (`+` masuk, `-` keluar);
- **Stok sebelum → stok sesudah**;
- **Catatan** bila ada.

> ⚠️ Riwayat lengkap baru dicatat sejak pembaruan ini. Mutasi transaksi lama tidak direkonstruksi; jika belum ada riwayat, artinya belum ada mutasi sejak update.

---

## 9. Catatan Penting

- **Transaksi lama** (sebelum fitur stok aktif) **tidak** memengaruhi stok. Stok mulai dihitung dari Isi Stok pertama.
- Stok **boleh minus** dari penjualan maupun pembatalan kulakan. Aplikasi tidak menolak penjualan hanya karena stok tidak mencukupi.
- Jika angka stok minus atau berbeda dari stok fisik, gunakan **Isi Stok** untuk memasukkan jumlah fisik terbaru.
- Backup otomatis menyertakan data stok dan riwayat opname — aman untuk pindah perangkat.

---

## Ringkasan Satu Kalimat

> **Kulakan = stok naik · Jualan = stok turun · Batalkan = dibalik · Isi Stok = perbaiki angka manual.**
