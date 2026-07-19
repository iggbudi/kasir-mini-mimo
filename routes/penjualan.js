const crypto = require('crypto');
const express = require('express');
const { getAll, getOne, run, withWriteTransaction } = require('../db/query');
const { success, fail } = require('../utils/response');
const {
  ValidationError,
  requirePositiveInteger,
  requirePositiveId,
  requireDateRange,
  optionalString,
  optionalRequestId
} = require('../utils/validate');
const { getTodayWib, getNowWib } = require('../utils/date');

const router = express.Router();
const PRICE_TYPES = new Set(['retail', 'grosir', 'khusus']);

class BusinessError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function parseItems(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ValidationError('Penjualan minimal memiliki satu barang');
  }
  if (value.length > 30) throw new ValidationError('Maksimal 30 baris barang per penjualan');

  return value.map((item, index) => {
    const field = `Barang baris ${index + 1}`;
    const barangId = requirePositiveId(item?.barang_id);
    const quantity = requirePositiveInteger(item?.quantity, `Quantity ${field}`);
    const harga = requirePositiveInteger(item?.harga, `Harga ${field}`);
    const jenisHarga = String(item?.jenis_harga || 'retail');
    if (!PRICE_TYPES.has(jenisHarga)) throw new ValidationError(`Jenis harga ${field} tidak valid`);
    if (!Number.isSafeInteger(quantity * harga)) throw new ValidationError(`Subtotal ${field} terlalu besar`);
    return { barang_id: barangId, quantity, harga, jenis_harga: jenisHarga };
  });
}

function hashPayload(items) {
  return crypto.createHash('sha256').update(JSON.stringify(items)).digest('hex');
}

async function getSale(transaction, id) {
  const headerResult = await transaction.execute({
    sql: `
      SELECT id, nomor_nota, total, tanggal, voided_at, void_reason
      FROM penjualan WHERE id = ?
    `,
    args: [id]
  });
  const header = headerResult.rows[0] || null;
  if (!header) return null;

  const itemsResult = await transaction.execute({
    sql: `
      SELECT id, barang_id, barang, quantity, harga, total, jenis_harga
      FROM pemasukan
      WHERE penjualan_id = ?
      ORDER BY id
    `,
    args: [id]
  });
  return { ...header, items: itemsResult.rows };
}

router.get('/', async (req, res) => {
  try {
    const range = requireDateRange(req.query.dari, req.query.sampai, getTodayWib());
    const items = await getAll(`
      SELECT
        p.id,
        p.nomor_nota,
        p.total,
        p.tanggal,
        COUNT(d.id) AS jumlah_item,
        0 AS legacy
      FROM penjualan p
      JOIN pemasukan d ON d.penjualan_id = p.id AND d.voided_at IS NULL
      WHERE p.voided_at IS NULL AND date(p.tanggal) BETWEEN :dari AND :sampai
      GROUP BY p.id

      UNION ALL

      SELECT
        l.id,
        'LAMA-' || l.id AS nomor_nota,
        l.total,
        l.tanggal,
        1 AS jumlah_item,
        1 AS legacy
      FROM pemasukan l
      WHERE l.penjualan_id IS NULL
        AND l.voided_at IS NULL
        AND date(l.tanggal) BETWEEN :dari AND :sampai

      ORDER BY tanggal DESC, id DESC
    `, { dari: range.dari, sampai: range.sampai });
    return success(res, items);
  } catch (err) {
    if (err instanceof ValidationError) return fail(res, 400, err.message);
    console.error(err);
    return fail(res, 500, 'Gagal mengambil penjualan');
  }
});

router.post('/', async (req, res) => {
  try {
    const parsedItems = parseItems(req.body?.items);
    const requestId = optionalRequestId(req.get('Idempotency-Key'));
    const payloadHash = hashPayload(parsedItems);
    const now = getNowWib();

    const sale = await withWriteTransaction(async (transaction) => {
      if (requestId) {
        const replayResult = await transaction.execute({
          sql: 'SELECT id, payload_hash FROM penjualan WHERE request_id = ?',
          args: [requestId]
        });
        const replay = replayResult.rows[0] || null;
        if (replay) {
          if (replay.payload_hash !== payloadHash) {
            throw new BusinessError(409, 'Idempotency-Key sudah dipakai untuk penjualan berbeda');
          }
          return getSale(transaction, replay.id);
        }
      }

      const productIds = [...new Set(parsedItems.map(item => item.barang_id))];
      const productResult = await transaction.execute({
        sql: `
          SELECT id, nama, harga_grosir
          FROM master_barang
          WHERE aktif = 1 AND id IN (${productIds.map(() => '?').join(', ')})
        `,
        args: productIds
      });
      const productById = new Map(productResult.rows.map(product => [Number(product.id), product]));

      const details = [];
      let total = 0;
      for (const item of parsedItems) {
        const product = productById.get(item.barang_id);
        if (!product) throw new BusinessError(400, `Barang ID ${item.barang_id} tidak ditemukan atau diarsipkan`);
        if (item.jenis_harga === 'grosir' && !product.harga_grosir) {
          throw new BusinessError(400, `${product.nama} tidak memiliki harga grosir`);
        }

        const subtotal = item.quantity * item.harga;
        total += subtotal;
        if (!Number.isSafeInteger(total)) throw new BusinessError(400, 'Total penjualan terlalu besar');
        details.push({ ...item, nama: product.nama });
      }

      const temporaryNumber = `TMP-${requestId || crypto.randomUUID()}`;
      const insertHeader = await transaction.execute({
        sql: `
          INSERT INTO penjualan (nomor_nota, total, tanggal, request_id, payload_hash)
          VALUES (?, ?, ?, ?, ?)
        `,
        args: [temporaryNumber, total, now, requestId, payloadHash]
      });
      const saleId = Number(insertHeader.lastInsertRowid);
      const noteNumber = `PJ-${now.slice(0, 10).replace(/-/g, '')}-${String(saleId).padStart(6, '0')}`;
      await transaction.execute({
        sql: 'UPDATE penjualan SET nomor_nota = ? WHERE id = ?',
        args: [noteNumber, saleId]
      });

      const detailPlaceholders = details.map(() => '(?, ?, ?, ?, ?, NULL, ?, ?)').join(', ');
      const detailArgs = details.flatMap(detail => [
        saleId,
        detail.barang_id,
        detail.nama,
        detail.quantity,
        detail.harga,
        now,
        detail.jenis_harga
      ]);
      await transaction.execute({
        sql: `
          INSERT INTO pemasukan
            (penjualan_id, barang_id, barang, quantity, harga, catatan, tanggal, jenis_harga)
          VALUES ${detailPlaceholders}
        `,
        args: detailArgs
      });

      return getSale(transaction, saleId);
    });

    return success(res, sale, null, 201);
  } catch (err) {
    if (err instanceof ValidationError) return fail(res, 400, err.message);
    if (err instanceof BusinessError) return fail(res, err.status, err.message);
    console.error(err);
    return fail(res, 500, 'Gagal menyimpan penjualan');
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = requirePositiveId(req.params.id);
    if (req.query.legacy === '1') {
      const item = await getOne(`
        SELECT id, barang_id, barang, quantity, harga, total, tanggal
        FROM pemasukan WHERE id = ? AND penjualan_id IS NULL
      `, [id]);
      if (!item) return fail(res, 404, 'Penjualan tidak ditemukan');
      return success(res, {
        id: item.id,
        nomor_nota: `LAMA-${item.id}`,
        total: item.total,
        tanggal: item.tanggal,
        legacy: true,
        items: [{ ...item, jenis_harga: 'khusus' }]
      });
    }

    const header = await getOne(`
      SELECT id, nomor_nota, total, tanggal, voided_at, void_reason
      FROM penjualan WHERE id = ?
    `, [id]);
    if (!header) return fail(res, 404, 'Penjualan tidak ditemukan');
    const details = await getAll(`
      SELECT id, barang_id, barang, quantity, harga, total, jenis_harga
      FROM pemasukan WHERE penjualan_id = ? ORDER BY id
    `, [id]);
    return success(res, { ...header, legacy: false, items: details });
  } catch (err) {
    if (err instanceof ValidationError) return fail(res, 400, err.message);
    console.error(err);
    return fail(res, 500, 'Gagal mengambil detail penjualan');
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = requirePositiveId(req.params.id);
    const reason = optionalString(req.body?.reason, 'Alasan pembatalan') || 'Dibatalkan oleh admin';
    if (reason.length > 200) return fail(res, 400, 'Alasan pembatalan maksimal 200 karakter');
    const now = getNowWib();

    if (req.query.legacy === '1') {
      const info = await run(`
        UPDATE pemasukan SET voided_at = ?, void_reason = ?
        WHERE id = ? AND penjualan_id IS NULL AND voided_at IS NULL
      `, [now, reason, id]);
      if (info.rowsAffected === 0) {
        const existing = await getOne('SELECT id, voided_at FROM pemasukan WHERE id = ? AND penjualan_id IS NULL', [id]);
        if (!existing) return fail(res, 404, 'Penjualan tidak ditemukan');
      }
      return success(res, { voided: true });
    }

    const result = await withWriteTransaction(async (transaction) => {
      const headerResult = await transaction.execute({
        sql: 'SELECT id, voided_at FROM penjualan WHERE id = ?',
        args: [id]
      });
      const header = headerResult.rows[0] || null;
      if (!header) throw new BusinessError(404, 'Penjualan tidak ditemukan');
      if (header.voided_at) return { voided: true, already_voided: true };

      await transaction.execute({
        sql: 'UPDATE penjualan SET voided_at = ?, void_reason = ? WHERE id = ?',
        args: [now, reason, id]
      });
      await transaction.execute({
        sql: `
          UPDATE pemasukan SET voided_at = ?, void_reason = ?
          WHERE penjualan_id = ? AND voided_at IS NULL
        `,
        args: [now, `Penjualan dibatalkan: ${reason}`.slice(0, 200), id]
      });
      return { voided: true, already_voided: false };
    });
    return success(res, result);
  } catch (err) {
    if (err instanceof ValidationError) return fail(res, 400, err.message);
    if (err instanceof BusinessError) return fail(res, err.status, err.message);
    console.error(err);
    return fail(res, 500, 'Gagal membatalkan penjualan');
  }
});

module.exports = router;
