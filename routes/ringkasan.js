const express = require('express');
const { getOne } = require('../db/query');
const { success, fail } = require('../utils/response');
const { getTodayWib } = require('../utils/date');

const router = express.Router();

function toSafeInteger(value, fieldName) {
  const number = Number(value || 0);
  if (!Number.isSafeInteger(number)) {
    throw new Error(`Nilai ${fieldName} melampaui batas aman`);
  }
  return number;
}

router.get('/', async (_req, res) => {
  try {
    const today = getTodayWib();
    const summary = await getOne(`
      SELECT
        COALESCE(
          (SELECT value FROM setting WHERE key = 'nama_warung'),
          'Warung Saya'
        ) AS nama_warung,
        COALESCE((
          SELECT SUM(total)
          FROM pemasukan
          WHERE voided_at IS NULL AND date(tanggal) = :today
        ), 0) AS pemasukan_penjualan,
        COALESCE((
          SELECT SUM(bayar)
          FROM kasbon_bayar
          WHERE voided_at IS NULL AND date(tanggal) = :today
        ), 0) AS pembayaran_kasbon,
        COALESCE((
          SELECT SUM(nominal)
          FROM pengeluaran
          WHERE voided_at IS NULL AND date(tanggal) = :today
        ), 0) AS pengeluaran,
        COALESCE((
          SELECT SUM(sisa)
          FROM kasbon
          WHERE voided_at IS NULL AND status = 'belum_lunas'
        ), 0) AS kasbon_outstanding,
        COALESCE((
          SELECT COUNT(*)
          FROM kasbon
          WHERE voided_at IS NULL AND status = 'belum_lunas'
        ), 0) AS kasbon_aktif
    `, { today });

    const pemasukanPenjualan = toSafeInteger(summary?.pemasukan_penjualan, 'pemasukan penjualan');
    const pembayaranKasbon = toSafeInteger(summary?.pembayaran_kasbon, 'pembayaran kasbon');
    const pengeluaran = toSafeInteger(summary?.pengeluaran, 'pengeluaran');
    const kasbonOutstanding = toSafeInteger(summary?.kasbon_outstanding, 'kasbon outstanding');
    const kasbonAktif = toSafeInteger(summary?.kasbon_aktif, 'jumlah kasbon aktif');
    const totalKasMasuk = pemasukanPenjualan + pembayaranKasbon;
    const sisaKas = totalKasMasuk - pengeluaran;

    if (!Number.isSafeInteger(totalKasMasuk) || !Number.isSafeInteger(sisaKas)) {
      throw new Error('Nilai ringkasan kas melampaui batas aman');
    }

    return success(res, {
      nama_warung: summary?.nama_warung || 'Warung Saya',
      tanggal: today,
      // Dipertahankan agar client lama tetap membaca pemasukan penjualan.
      pemasukan: pemasukanPenjualan,
      pemasukan_penjualan: pemasukanPenjualan,
      pembayaran_kasbon: pembayaranKasbon,
      total_kas_masuk: totalKasMasuk,
      pengeluaran,
      sisa_kas: sisaKas,
      kasbon_outstanding: kasbonOutstanding,
      kasbon_aktif: kasbonAktif,
      // Alias kompatibilitas; nilainya adalah jumlah record kasbon aktif, bukan orang unik.
      kasbon_jumlah_orang: kasbonAktif
    });
  } catch (err) {
    console.error(err);
    return fail(res, 500, 'Gagal mengambil ringkasan');
  }
});

module.exports = router;
