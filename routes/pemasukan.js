const express = require('express');
const { getAll, getOne, run } = require('../db/query');
const { success, fail } = require('../utils/response');
const {
  ValidationError,
  requireString,
  requirePositiveInteger,
  optionalPositiveInteger,
  requirePositiveId,
  requireDateRange,
  optionalString,
  optionalRequestId
} = require('../utils/validate');
const { getTodayWib, getNowWib } = require('../utils/date');

const router = express.Router();
const PUBLIC_COLUMNS = 'id, barang_id, barang, quantity, harga, total, catatan, tanggal';

router.get('/', async (req, res) => {
  try {
    const range = requireDateRange(req.query.dari, req.query.sampai, getTodayWib());
    const sql = `
      SELECT ${PUBLIC_COLUMNS} FROM pemasukan
      WHERE penjualan_id IS NULL AND voided_at IS NULL AND date(tanggal) BETWEEN ? AND ?
      ORDER BY tanggal DESC
    `;
    const items = await getAll(sql, [range.dari, range.sampai]);
    return success(res, items);
  } catch (err) {
    if (err instanceof ValidationError) return fail(res, 400, err.message);
    console.error(err);
    return fail(res, 500, 'Gagal mengambil data pemasukan');
  }
});

router.post('/', async (req, res) => {
  try {
    const barangId = optionalPositiveInteger(req.body?.barang_id, 'Barang');
    let barang = optionalString(req.body?.barang, 'Barang');
    const quantity = requirePositiveInteger(req.body?.quantity, 'Quantity');
    const harga = requirePositiveInteger(req.body?.harga, 'Harga');
    const catatan = optionalString(req.body?.catatan, 'Catatan');
    const requestId = optionalRequestId(req.get('Idempotency-Key'));

    if (requestId) {
      const replay = await getOne(`SELECT ${PUBLIC_COLUMNS} FROM pemasukan WHERE request_id = ?`, [requestId]);
      if (replay) {
        const samePayload = (replay.barang_id ?? null) === barangId
          && (barangId !== null || replay.barang === barang)
          && replay.quantity === quantity
          && replay.harga === harga
          && (replay.catatan ?? null) === catatan;
        if (!samePayload) return fail(res, 409, 'Idempotency-Key sudah dipakai untuk data berbeda');
        return success(res, replay);
      }
    }

    if (barangId !== null) {
      const master = await getOne('SELECT nama FROM master_barang WHERE id = ? AND aktif = 1', [barangId]);
      if (!master) return fail(res, 400, 'Barang master tidak ditemukan atau sudah diarsipkan');
      barang = master.nama;
    } else {
      barang = requireString(req.body?.barang, 'Barang');
    }

    if (barang.length > 100) return fail(res, 400, 'Barang maksimal 100 karakter');
    if (catatan && catatan.length > 200) return fail(res, 400, 'Catatan maksimal 200 karakter');
    if (!Number.isSafeInteger(quantity * harga)) return fail(res, 400, 'Total pemasukan terlalu besar');

    const info = await run(`
      INSERT INTO pemasukan (barang_id, barang, quantity, harga, catatan, tanggal, request_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT DO NOTHING
    `, [barangId, barang, quantity, harga, catatan, getNowWib(), requestId]);

    if (info.rowsAffected === 0) {
      const existing = await getOne(`SELECT ${PUBLIC_COLUMNS} FROM pemasukan WHERE request_id = ?`, [requestId]);
      const samePayload = existing
        && (existing.barang_id ?? null) === barangId
        && (barangId !== null || existing.barang === barang)
        && existing.quantity === quantity
        && existing.harga === harga
        && (existing.catatan ?? null) === catatan;
      if (!samePayload) return fail(res, 409, 'Idempotency-Key sudah dipakai untuk data berbeda');
      return success(res, existing);
    }

    const created = await getOne(`SELECT ${PUBLIC_COLUMNS} FROM pemasukan WHERE id = ?`, [info.lastInsertRowid]);
    return success(res, created);
  } catch (err) {
    if (err instanceof ValidationError) return fail(res, 400, err.message);
    console.error(err);
    return fail(res, 500, 'Gagal menyimpan pemasukan');
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = requirePositiveId(req.params.id);
    const reason = optionalString(req.body?.reason, 'Alasan pembatalan') || 'Dibatalkan oleh admin';
    if (reason.length > 200) return fail(res, 400, 'Alasan pembatalan maksimal 200 karakter');

    const existing = await getOne('SELECT id, penjualan_id, voided_at FROM pemasukan WHERE id = ?', [id]);
    if (!existing) return fail(res, 404, 'ID tidak ditemukan');
    if (existing.penjualan_id) return fail(res, 400, 'Batalkan melalui endpoint penjualan');
    if (existing.voided_at) return success(res, { voided: true, already_voided: true });

    await run(
      'UPDATE pemasukan SET voided_at = ?, void_reason = ? WHERE id = ? AND voided_at IS NULL',
      [getNowWib(), reason, id]
    );
    return success(res, { voided: true, already_voided: false });
  } catch (err) {
    if (err instanceof ValidationError) return fail(res, 400, err.message);
    console.error(err);
    return fail(res, 500, 'Gagal membatalkan pemasukan');
  }
});

module.exports = router;
