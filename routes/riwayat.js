const express = require('express');
const { getAll } = require('../db/query');
const { success, fail } = require('../utils/response');
const { ValidationError, requireDateRange } = require('../utils/validate');
const { getTodayWib } = require('../utils/date');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const range = requireDateRange(req.query.dari, req.query.sampai, getTodayWib());
    const dateFilter = 'WHERE date(tanggal) BETWEEN :dari AND :sampai';
    const params = { dari: range.dari, sampai: range.sampai };

    const pemasukanSql = `
      SELECT
        'pemasukan' as tipe,
        id,
        barang as label,
        total as nominal,
        'masuk' as arah,
        CASE WHEN voided_at IS NULL THEN total ELSE 0 END as dampak_kas,
        CASE WHEN voided_at IS NULL THEN 0 ELSE 1 END as dibatalkan,
        voided_at,
        void_reason,
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
        'keluar' as arah,
        CASE WHEN voided_at IS NULL THEN -nominal ELSE 0 END as dampak_kas,
        CASE WHEN voided_at IS NULL THEN 0 ELSE 1 END as dibatalkan,
        voided_at,
        void_reason,
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
        'non_kas' as arah,
        0 as dampak_kas,
        CASE WHEN voided_at IS NULL THEN 0 ELSE 1 END as dibatalkan,
        voided_at,
        void_reason,
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
        'masuk' as arah,
        CASE WHEN kb.voided_at IS NULL THEN kb.bayar ELSE 0 END as dampak_kas,
        CASE WHEN kb.voided_at IS NULL THEN 0 ELSE 1 END as dibatalkan,
        kb.voided_at,
        kb.void_reason,
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
      ORDER BY tanggal DESC, tipe ASC, id DESC
    `;

    const items = await getAll(fullSql, params);
    return success(res, { items });
  } catch (err) {
    if (err instanceof ValidationError) return fail(res, 400, err.message);
    console.error(err);
    return fail(res, 500, 'Gagal mengambil riwayat');
  }
});

module.exports = router;
