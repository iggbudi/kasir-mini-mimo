const express = require('express');
const db = require('../db/connection');
const { success, fail } = require('../utils/response');

const router = express.Router();

router.get('/', (_req, res) => {
  try {
    // Get nama_warung
    const settingRow = db.prepare("SELECT value FROM setting WHERE key = 'nama_warung'").get();
    const namaWarung = settingRow ? settingRow.value : 'Warung Saya';

    // Today's date in local YYYY-MM-DD for filtering
    const today = new Date().toISOString().split('T')[0];

    // Pemasukan hari ini
    const pemasukanRow = db.prepare(`
      SELECT COALESCE(SUM(total), 0) as total
      FROM pemasukan
      WHERE date(tanggal) = ?
    `).get(today);
    const pemasukan = pemasukanRow ? pemasukanRow.total : 0;

    // Pengeluaran hari ini
    const pengeluaranRow = db.prepare(`
      SELECT COALESCE(SUM(nominal), 0) as total
      FROM pengeluaran
      WHERE date(tanggal) = ?
    `).get(today);
    const pengeluaran = pengeluaranRow ? pengeluaranRow.total : 0;

    const sisaKas = pemasukan - pengeluaran;

    // Kasbon outstanding (belum lunas)
    const kasbonRow = db.prepare(`
      SELECT 
        COALESCE(SUM(sisa), 0) as outstanding,
        COUNT(*) as jumlah_orang
      FROM kasbon
      WHERE status = 'belum_lunas'
    `).get();
    const kasbonOutstanding = kasbonRow ? kasbonRow.outstanding : 0;
    const kasbonJumlahOrang = kasbonRow ? kasbonRow.jumlah_orang : 0;

    return success(res, {
      nama_warung: namaWarung,
      tanggal: today,
      pemasukan,
      pengeluaran,
      sisa_kas: sisaKas,
      kasbon_outstanding: kasbonOutstanding,
      kasbon_jumlah_orang: kasbonJumlahOrang
    });
  } catch (err) {
    console.error(err);
    return fail(res, 500, 'Gagal mengambil ringkasan');
  }
});

module.exports = router;
