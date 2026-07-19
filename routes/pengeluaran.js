const express = require('express');
const { getAll, getOne, run } = require('../db/query');
const { success, fail } = require('../utils/response');
const {
  ValidationError,
  requireString,
  requirePositiveInteger,
  requirePositiveId,
  requireDateRange,
  optionalString,
  optionalRequestId
} = require('../utils/validate');
const { getTodayWib, getNowWib } = require('../utils/date');

const router = express.Router();
const PUBLIC_COLUMNS = 'id, keterangan, nominal, catatan, tanggal';

router.get('/', async (req, res) => {
  try {
    const range = requireDateRange(req.query.dari, req.query.sampai, getTodayWib());
    const sql = `
      SELECT ${PUBLIC_COLUMNS} FROM pengeluaran
      WHERE voided_at IS NULL AND date(tanggal) BETWEEN ? AND ?
      ORDER BY tanggal DESC
    `;
    const items = await getAll(sql, [range.dari, range.sampai]);
    return success(res, items);
  } catch (err) {
    if (err instanceof ValidationError) return fail(res, 400, err.message);
    console.error(err);
    return fail(res, 500, 'Gagal mengambil data pengeluaran');
  }
});

router.post('/', async (req, res) => {
  try {
    const keterangan = requireString(req.body?.keterangan, 'Keterangan');
    const nominal = requirePositiveInteger(req.body?.nominal, 'Nominal');
    const catatan = optionalString(req.body?.catatan, 'Catatan');
    const requestId = optionalRequestId(req.get('Idempotency-Key'));

    if (keterangan.length > 100) return fail(res, 400, 'Keterangan maksimal 100 karakter');
    if (catatan && catatan.length > 200) return fail(res, 400, 'Catatan maksimal 200 karakter');

    const info = await run(`
      INSERT INTO pengeluaran (keterangan, nominal, catatan, tanggal, request_id)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT DO NOTHING
    `, [keterangan, nominal, catatan, getNowWib(), requestId]);

    if (info.rowsAffected === 0) {
      const existing = await getOne(`SELECT ${PUBLIC_COLUMNS} FROM pengeluaran WHERE request_id = ?`, [requestId]);
      const samePayload = existing
        && existing.keterangan === keterangan
        && existing.nominal === nominal
        && (existing.catatan ?? null) === catatan;
      if (!samePayload) return fail(res, 409, 'Idempotency-Key sudah dipakai untuk data berbeda');
      return success(res, existing);
    }

    const created = await getOne(`SELECT ${PUBLIC_COLUMNS} FROM pengeluaran WHERE id = ?`, [info.lastInsertRowid]);
    return success(res, created);
  } catch (err) {
    if (err instanceof ValidationError) return fail(res, 400, err.message);
    console.error(err);
    return fail(res, 500, 'Gagal menyimpan pengeluaran');
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = requirePositiveId(req.params.id);
    const reason = optionalString(req.body?.reason, 'Alasan pembatalan') || 'Dibatalkan oleh admin';
    if (reason.length > 200) return fail(res, 400, 'Alasan pembatalan maksimal 200 karakter');

    const existing = await getOne('SELECT id, voided_at FROM pengeluaran WHERE id = ?', [id]);
    if (!existing) return fail(res, 404, 'ID tidak ditemukan');
    if (existing.voided_at) return success(res, { voided: true, already_voided: true });

    await run(
      'UPDATE pengeluaran SET voided_at = ?, void_reason = ? WHERE id = ? AND voided_at IS NULL',
      [getNowWib(), reason, id]
    );
    return success(res, { voided: true, already_voided: false });
  } catch (err) {
    if (err instanceof ValidationError) return fail(res, 400, err.message);
    console.error(err);
    return fail(res, 500, 'Gagal membatalkan pengeluaran');
  }
});

module.exports = router;
