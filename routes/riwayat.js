const express = require('express');
const { getAll } = require('../db/query');
const { success, fail } = require('../utils/response');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { dari, sampai } = req.query;

    let dateFilter = '';
    const params = [];

    if (dari && sampai) {
      dateFilter = 'WHERE date(tanggal) BETWEEN ? AND ?';
      params.push(dari, sampai);
    } else {
      dateFilter = "WHERE date(tanggal) = date('now', 'localtime')";
    }

    const pemasukanSql = `
      SELECT
        'pemasukan' as tipe,
        id,
        barang as label,
        total as nominal,
        tanggal
      FROM pemasukan
      ${dateFilter}
    `;

    const pengeluaranSql = `
      SELECT
        'pengeluaran' as tipe,
        id,
        keterangan as label,
        nominal,
        tanggal
      FROM pengeluaran
      ${dateFilter}
    `;

    const kasbonSql = `
      SELECT
        'kasbon' as tipe,
        id,
        nama as label,
        nominal,
        tanggal
      FROM kasbon
      ${dateFilter}
    `;

    const bayarSql = `
      SELECT
        'kasbon_bayar' as tipe,
        kb.id,
        'Pembayaran: ' || COALESCE(k.nama, '') as label,
        kb.bayar as nominal,
        kb.tanggal
      FROM kasbon_bayar kb
      LEFT JOIN kasbon k ON k.id = kb.kasbon_id
      ${dateFilter.replace('tanggal', 'kb.tanggal')}
    `;

    const fullSql = `
      ${pemasukanSql}
      UNION ALL
      ${pengeluaranSql}
      UNION ALL
      ${kasbonSql}
      UNION ALL
      ${bayarSql}
      ORDER BY tanggal DESC
    `;

    const items = await getAll(fullSql, params);
    return success(res, { items });
  } catch (err) {
    console.error(err);
    return fail(res, 500, 'Gagal mengambil riwayat');
  }
});

module.exports = router;
