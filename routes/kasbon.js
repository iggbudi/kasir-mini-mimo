const express = require('express');
const { getAll, getOne, run, withWriteTransaction } = require('../db/query');
const { success, fail } = require('../utils/response');
const {
  ValidationError,
  requireString,
  requirePositiveInteger,
  requirePositiveId,
  optionalString,
  optionalRequestId
} = require('../utils/validate');
const { getNowWib } = require('../utils/date');

const router = express.Router();
const VALID_STATUSES = new Set(['belum_lunas', 'lunas', 'semua']);
const KASBON_COLUMNS = 'id, nama, nominal, sisa, keterangan, status, tanggal';
const PAYMENT_COLUMNS = 'id, kasbon_id, bayar, tanggal';

class BusinessError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

router.get('/', async (req, res) => {
  try {
    const status = req.query.status === undefined ? 'belum_lunas' : req.query.status;
    if (typeof status !== 'string' || !VALID_STATUSES.has(status)) {
      throw new ValidationError('Status kasbon tidak valid');
    }

    let sql = `SELECT ${KASBON_COLUMNS} FROM kasbon WHERE voided_at IS NULL`;
    const params = [];
    if (status === 'belum_lunas' || status === 'lunas') {
      sql += ' AND status = ?';
      params.push(status);
    }
    sql += ' ORDER BY tanggal DESC';

    const items = await getAll(sql, params);
    return success(res, items);
  } catch (err) {
    if (err instanceof ValidationError) return fail(res, 400, err.message);
    console.error(err);
    return fail(res, 500, 'Gagal mengambil data kasbon');
  }
});

router.post('/', async (req, res) => {
  try {
    const nama = requireString(req.body?.nama, 'Nama');
    const nominal = requirePositiveInteger(req.body?.nominal, 'Nominal');
    const keterangan = optionalString(req.body?.keterangan, 'Keterangan');
    const requestId = optionalRequestId(req.get('Idempotency-Key'));

    if (nama.length > 50) return fail(res, 400, 'Nama maksimal 50 karakter');
    if (keterangan && keterangan.length > 200) return fail(res, 400, 'Keterangan maksimal 200 karakter');

    const info = await run(`
      INSERT INTO kasbon (nama, nominal, sisa, keterangan, tanggal, request_id)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT DO NOTHING
    `, [nama, nominal, nominal, keterangan, getNowWib(), requestId]);

    if (info.rowsAffected === 0) {
      const existing = await getOne(`SELECT ${KASBON_COLUMNS} FROM kasbon WHERE request_id = ?`, [requestId]);
      const samePayload = existing
        && existing.nama === nama
        && existing.nominal === nominal
        && (existing.keterangan ?? null) === keterangan;
      if (!samePayload) return fail(res, 409, 'Idempotency-Key sudah dipakai untuk data berbeda');
      return success(res, existing);
    }

    const created = await getOne(`SELECT ${KASBON_COLUMNS} FROM kasbon WHERE id = ?`, [info.lastInsertRowid]);
    return success(res, created);
  } catch (err) {
    if (err instanceof ValidationError) return fail(res, 400, err.message);
    console.error(err);
    return fail(res, 500, 'Gagal menyimpan kasbon');
  }
});

router.post('/:id/bayar', async (req, res) => {
  try {
    const id = requirePositiveId(req.params.id);
    const bayar = requirePositiveInteger(req.body?.bayar, 'Bayar');
    const requestId = optionalRequestId(req.get('Idempotency-Key'));
    const now = getNowWib();

    const result = await withWriteTransaction(async (transaction) => {
      if (requestId) {
        const replayResult = await transaction.execute({
          sql: `SELECT ${PAYMENT_COLUMNS} FROM kasbon_bayar WHERE request_id = ?`,
          args: [requestId]
        });
        const replay = replayResult.rows[0] || null;
        if (replay) {
          if (replay.kasbon_id !== id || replay.bayar !== bayar) {
            throw new BusinessError(409, 'Idempotency-Key sudah dipakai untuk pembayaran berbeda');
          }
          const replayKasbon = await transaction.execute({
            sql: `SELECT ${KASBON_COLUMNS} FROM kasbon WHERE id = ?`,
            args: [id]
          });
          return { kasbon: replayKasbon.rows[0], pembayaran: replay, idempotent_replay: true };
        }
      }

      const kasbonResult = await transaction.execute({
        sql: 'SELECT * FROM kasbon WHERE id = ?',
        args: [id]
      });
      const kasbon = kasbonResult.rows[0] || null;

      if (!kasbon) throw new BusinessError(404, 'ID tidak ditemukan');
      if (kasbon.voided_at) throw new BusinessError(400, 'Kasbon sudah dibatalkan');
      if (kasbon.status === 'lunas') throw new BusinessError(400, 'Kasbon sudah lunas');
      if (bayar > kasbon.sisa) throw new BusinessError(400, 'Jumlah bayar melebihi sisa');

      const updateResult = await transaction.execute({
        sql: `
          UPDATE kasbon
          SET
            sisa = sisa - ?,
            status = CASE WHEN sisa = ? THEN 'lunas' ELSE 'belum_lunas' END
          WHERE id = ? AND status = 'belum_lunas' AND voided_at IS NULL AND sisa = ?
        `,
        args: [bayar, bayar, id, kasbon.sisa]
      });
      if (updateResult.rowsAffected !== 1) {
        throw new BusinessError(409, 'Kasbon berubah, silakan muat ulang dan coba lagi');
      }

      const insertResult = await transaction.execute({
        sql: 'INSERT INTO kasbon_bayar (kasbon_id, bayar, tanggal, request_id) VALUES (?, ?, ?, ?)',
        args: [id, bayar, now, requestId]
      });
      const paymentId = Number(insertResult.lastInsertRowid);

      const updatedResult = await transaction.execute({
        sql: `SELECT ${KASBON_COLUMNS} FROM kasbon WHERE id = ?`,
        args: [id]
      });
      const paymentResult = await transaction.execute({
        sql: `SELECT ${PAYMENT_COLUMNS} FROM kasbon_bayar WHERE id = ?`,
        args: [paymentId]
      });

      return {
        kasbon: updatedResult.rows[0],
        pembayaran: paymentResult.rows[0],
        idempotent_replay: false
      };
    });

    return success(res, result);
  } catch (err) {
    if (err instanceof ValidationError) return fail(res, 400, err.message);
    if (err instanceof BusinessError) return fail(res, err.status, err.message);
    console.error(err);
    return fail(res, 500, 'Gagal memproses pembayaran');
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = requirePositiveId(req.params.id);
    const reason = optionalString(req.body?.reason, 'Alasan pembatalan') || 'Dibatalkan oleh admin';
    if (reason.length > 200) return fail(res, 400, 'Alasan pembatalan maksimal 200 karakter');
    const now = getNowWib();

    const result = await withWriteTransaction(async (transaction) => {
      const existingResult = await transaction.execute({
        sql: 'SELECT id, voided_at FROM kasbon WHERE id = ?',
        args: [id]
      });
      const existing = existingResult.rows[0] || null;
      if (!existing) throw new BusinessError(404, 'ID tidak ditemukan');
      if (existing.voided_at) return { voided: true, already_voided: true, voided_payments: 0 };

      await transaction.execute({
        sql: 'UPDATE kasbon SET voided_at = ?, void_reason = ? WHERE id = ? AND voided_at IS NULL',
        args: [now, reason, id]
      });
      const paymentsResult = await transaction.execute({
        sql: `
          UPDATE kasbon_bayar
          SET voided_at = ?, void_reason = ?
          WHERE kasbon_id = ? AND voided_at IS NULL
        `,
        args: [now, `Kasbon dibatalkan: ${reason}`.slice(0, 200), id]
      });

      return {
        voided: true,
        already_voided: false,
        voided_payments: paymentsResult.rowsAffected
      };
    });

    return success(res, result);
  } catch (err) {
    if (err instanceof ValidationError) return fail(res, 400, err.message);
    if (err instanceof BusinessError) return fail(res, err.status, err.message);
    console.error(err);
    return fail(res, 500, 'Gagal membatalkan kasbon');
  }
});

module.exports = router;
