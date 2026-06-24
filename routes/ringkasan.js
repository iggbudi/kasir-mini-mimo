const express = require('express');
const { getOne } = require('../db/query');
const { success, fail } = require('../utils/response');

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const settingRow = await getOne("SELECT value FROM setting WHERE key = 'nama_warung'");
    const namaWarung = settingRow ? settingRow.value : 'Warung Saya';

    const today = new Date().toISOString().split('T')[0];

    const pemasukanRow = await getOne(`
      SELECT COALESCE(SUM(total), 0) as total
      FROM pemasukan
      WHERE date(tanggal) = ?
    `, [today]);
    const pemasukan = pemasukanRow ? pemasukanRow.total : 0;

    const pengeluaranRow = await getOne(`
      SELECT COALESCE(SUM(nominal), 0) as total
      FROM pengeluaran
      WHERE date(tanggal) = ?
    `, [today]);
    const pengeluaran = pengeluaranRow ? pengeluaranRow.total : 0;

    const sisaKas = pemasukan - pengeluaran;

    const kasbonRow = await getOne(`
      SELECT
        COALESCE(SUM(sisa), 0) as outstanding,
        COUNT(*) as jumlah_orang
      FROM kasbon
      WHERE status = 'belum_lunas'
    `);
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
