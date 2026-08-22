const express = require('express');
const { getAll } = require('../db/query');
const { success, fail } = require('../utils/response');
const { ValidationError, requireDateRange, parseLimit, parseOffset } = require('../utils/validate');
const { getTodayWib } = require('../utils/date');

const router = express.Router();

const VALID_TIPE = new Set(['semua', 'pemasukan', 'penjualan', 'pengeluaran', 'kasbon', 'kulakan', 'kasbon_bayar']);

router.get('/', async (req, res) => {
  try {
    const range = requireDateRange(req.query.dari, req.query.sampai, getTodayWib());
    const tipe = req.query.tipe === undefined || req.query.tipe === '' ? 'semua' : String(req.query.tipe);
    if (!VALID_TIPE.has(tipe)) throw new ValidationError('Tipe riwayat tidak valid');
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
      AND penjualan_id IS NULL
    `;

    const penjualanSql = `
      SELECT
        'penjualan' as tipe,
        id,
        nomor_nota as label,
        total as nominal,
        'masuk' as arah,
        CASE WHEN voided_at IS NULL THEN total ELSE 0 END as dampak_kas,
        CASE WHEN voided_at IS NULL THEN 0 ELSE 1 END as dibatalkan,
        voided_at,
        void_reason,
        tanggal
      FROM penjualan
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

    const kulakanSql = `
      SELECT
        'kulakan' as tipe,
        id,
        nomor_kulakan || ' · ' || salesman_nama as label,
        total as nominal,
        'keluar' as arah,
        CASE WHEN voided_at IS NULL THEN -total ELSE 0 END as dampak_kas,
        CASE WHEN voided_at IS NULL THEN 0 ELSE 1 END as dibatalkan,
        voided_at,
        void_reason,
        tanggal
      FROM kulakan
      ${dateFilter}
    `;

    const bayarSql = `
      SELECT
        'kasbon_bayar' as tipe,
        kb.id as id,
        'Pembayaran: ' || COALESCE(k.nama, '') as label,
        kb.bayar as nominal,
        'masuk' as arah,
        CASE WHEN kb.voided_at IS NULL THEN kb.bayar ELSE 0 END as dampak_kas,
        CASE WHEN kb.voided_at IS NULL THEN 0 ELSE 1 END as dibatalkan,
        kb.voided_at,
        kb.void_reason,
        kb.tanggal as tanggal
      FROM kasbon_bayar kb
      LEFT JOIN kasbon k ON k.id = kb.kasbon_id
      ${dateFilter.replace('tanggal', 'kb.tanggal')}
    `;

    const sqlByTipe = {
      pemasukan: pemasukanSql,
      penjualan: penjualanSql,
      pengeluaran: pengeluaranSql,
      kasbon: kasbonSql,
      kulakan: kulakanSql,
      kasbon_bayar: bayarSql
    };
    const unionSql = tipe === 'semua'
      ? `${pemasukanSql} UNION ALL ${penjualanSql} UNION ALL ${pengeluaranSql} UNION ALL ${kasbonSql} UNION ALL ${kulakanSql} UNION ALL ${bayarSql}`
      : sqlByTipe[tipe];

    const hasPagination = req.query.limit !== undefined || req.query.offset !== undefined;
    if (!hasPagination) {
      const fullSql = ` ${unionSql} ORDER BY tanggal DESC, tipe ASC, id DESC`;
      const items = await getAll(fullSql, params);
      return success(res, { items });
    }
    const limit = parseLimit(req.query.limit);
    const offset = parseOffset(req.query.offset);
    const paginatedSql = `SELECT * FROM ( ${unionSql} ) ORDER BY tanggal DESC, tipe ASC, id DESC LIMIT :limit OFFSET :offset`;
    const paginatedParams = { ...params, limit: limit + 1, offset };
    const rows = await getAll(paginatedSql, paginatedParams);
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return success(res, { items, pagination: { limit, offset, has_more: hasMore } });
  } catch (err) {
    if (err instanceof ValidationError) return fail(res, 400, err.message);
    console.error(err);
    return fail(res, 500, 'Gagal mengambil riwayat');
  }
});

module.exports = router;
