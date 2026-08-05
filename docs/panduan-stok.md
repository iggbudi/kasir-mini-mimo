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

- Saat mencari barang, **stok tersedia** ikut terlihat (contoh: "Gula 1kg — Rp17.500 · Stok 12").
- Jika kamu mengetik jumlah **lebih dari stok**, muncul peringatan:
  > "Stok Gula 1kg tinggal 12. Jumlah dibatasi ke stok tersedia."
  
  Jumlah otomatis dipatok ke stok yang ada. Misalnya stok 12, tidak bisa input 15.
- Jika stok barang **0**:
  > "Stok Gula 1kg habis, tidak bisa dijual."

  Barang tidak bisa ditambahkan sampai stoknya diisi (mis. setelah kulakan).
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
- **Stok minus** — akibat membatalkan kulakan yang barangnya sudah laku.
- **Awal barang baru** — barang lama yang pernah diarsipkan lalu diaktifkan kembali (stoknya mulai dari angka lama; set ulang jika perlu).

Cara: **Master Barang → Isi Stok** pada barang tersebut → ketik angka stok fisik terbaru → Simpan. Setiap kali Isi Stok, aplikasi menyimpan **riwayat perubahannya** (terlihat di file backup).

---

## 6. Catatan Penting

- **Transaksi lama** (sebelum fitur stok aktif) **tidak** memengaruhi stok. Stok mulai dihitung dari Isi Stok pertama.
- Stok tidak bisa minus dari **penjualan** — aplikasi menolak jual melebihi stok. Stok minus hanya mungkin dari pembatalan kulakan.
- Backup otomatis menyertakan data stok dan riwayat opname — aman untuk pindah perangkat.

---

## Ringkasan Satu Kalimat

> **Kulakan = stok naik · Jualan = stok turun · Batalkan = dibalik · Isi Stok = perbaiki angka manual.**
