const crypto = require('crypto');
const express = require('express');
const { getAll, getOne, run, withWriteTransaction } = require('../db/query');
const { success, fail } = require('../utils/response');
const { updateStockWithMutation } = require('../utils/stock');
const {
  ValidationError,
  requirePositiveInteger,
  requirePositiveId,
  requireDateRange,
  optionalString,
  optionalRequestId,
  parseLimit,
  parseOffset
} = require('../utils/validate');
const { getTodayWib, getNowWib } = require('../utils/date');

const router = express.Router();
const PRICE_TYPES = new Set(['retail', 'grosir']);

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
    if (!Number.isSafeInteger(quantity * harga)) throw new ValidationError(`Subtotal ${field} terlalu besar`);
    return { barang_id: barangId, quantity, harga };
  });
}

function hashPayload(jenisHarga, items) {
  return crypto.createHash('sha256').update(JSON.stringify({ jenis_harga: jenisHarga, items })).digest('hex');
}

async function getSale(transaction, id) {
  const headerResult = await transaction.execute({
    sql: `
      SELECT id, nomor_nota, jenis_harga, total, tanggal, voided_at, void_reason
      FROM penjualan WHERE id = ?
    `,
    args: [id]
  });
  const header = headerResult.rows[0] || null;
  if (!header) return null;

  const itemsResult = await transaction.execute({
    sql: `
      SELECT id, barang_id, barang, quantity, harga, total
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
    const hasPagination = req.query.limit !== undefined || req.query.offset !== undefined;

    if (!hasPagination) {
      const items = await getAll(`
        SELECT * FROM (
          SELECT p.id, p.nomor_nota, p.total, p.tanggal, p.jenis_harga, COUNT(d.id) AS jumlah_item, 0 AS legacy FROM penjualan p JOIN pemasukan d ON d.penjualan_id = p.id AND d.voided_at IS NULL WHERE p.voided_at IS NULL AND date(p.tanggal) BETWEEN :dari AND :sampai GROUP BY p.id
          UNION ALL
          SELECT l.id, 'LAMA-' || l.id AS nomor_nota, l.total, l.tanggal, CASE WHEN l.jenis_harga = 'grosir' THEN 'grosir' ELSE 'retail' END AS jenis_harga, 1 AS jumlah_item, 1 AS legacy FROM pemasukan l WHERE l.penjualan_id IS NULL AND l.voided_at IS NULL AND date(l.tanggal) BETWEEN :dari AND :sampai
        ) ORDER BY tanggal DESC, id DESC
      `, { dari: range.dari, sampai: range.sampai });
      return success(res, items);
    }

    const limit = parseLimit(req.query.limit);
    const offset = parseOffset(req.query.offset);
    const rows = await getAll(`
      SELECT * FROM (
        SELECT p.id, p.nomor_nota, p.total, p.tanggal, p.jenis_harga, COUNT(d.id) AS jumlah_item, 0 AS legacy FROM penjualan p JOIN pemasukan d ON d.penjualan_id = p.id AND d.voided_at IS NULL WHERE p.voided_at IS NULL AND date(p.tanggal) BETWEEN :dari AND :sampai GROUP BY p.id
        UNION ALL
        SELECT l.id, 'LAMA-' || l.id AS nomor_nota, l.total, l.tanggal, CASE WHEN l.jenis_harga = 'grosir' THEN 'grosir' ELSE 'retail' END AS jenis_harga, 1 AS jumlah_item, 1 AS legacy FROM pemasukan l WHERE l.penjualan_id IS NULL AND l.voided_at IS NULL AND date(l.tanggal) BETWEEN :dari AND :sampai
      ) ORDER BY tanggal DESC, id DESC LIMIT :limit OFFSET :offset
    `, { dari: range.dari, sampai: range.sampai, limit: limit + 1, offset });
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return success(res, { items, pagination: { limit, offset, has_more: hasMore } });
  } catch (err) {
    if (err instanceof ValidationError) return fail(res, 400, err.message);
    console.error(err);
    return fail(res, 500, 'Gagal mengambil penjualan');
  }
});

router.post('/', async (req, res) => {
  try {
    const jenisHarga = String(req.body?.jenis_harga || 'retail');
    if (!PRICE_TYPES.has(jenisHarga)) throw new ValidationError('Jenis harga penjualan tidak valid');
    const parsedItems = parseItems(req.body?.items);
    const requestId = optionalRequestId(req.get('Idempotency-Key'));
    const payloadHash = hashPayload(jenisHarga, parsedItems);
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
          SELECT id, nama, stok
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

        const subtotal = item.quantity * item.harga;
        total += subtotal;
        if (!Number.isSafeInteger(total)) throw new BusinessError(400, 'Total penjualan terlalu besar');
        details.push({ ...item, nama: product.nama });
      }

      const temporaryNumber = `TMP-${requestId || crypto.randomUUID()}`;
      const insertHeader = await transaction.execute({
        sql: `
          INSERT INTO penjualan (nomor_nota, jenis_harga, total, tanggal, request_id, payload_hash)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        args: [temporaryNumber, jenisHarga, total, now, requestId, payloadHash]
      });
      const saleId = Number(insertHeader.lastInsertRowid);
      const noteNumber = `PJ-${now.slice(0, 10).replace(/-/g, '')}-${String(saleId).padStart(6, '0')}`;
      await transaction.execute({
        sql: 'UPDATE penjualan SET nomor_nota = ? WHERE id = ?',
        args: [noteNumber, saleId]
      });

      // Stok: kurangi dalam transaksi yang sama dan tulis satu ledger agregat
      // per barang. Stok boleh minus (mis. barang dijual lebih dulu, diinput
      // ke sistem belakangan).
      const qtyByProduct = new Map();
      for (const detail of details) {
        qtyByProduct.set(detail.barang_id, (qtyByProduct.get(detail.barang_id) || 0) + detail.quantity);
      }
      for (const [productId, qty] of qtyByProduct) {
        const mutation = await updateStockWithMutation(transaction, {
          barangId: productId,
          mode: 'delta',
          amount: -qty,
          type: 'penjualan',
          referenceId: saleId,
          timestamp: now
        });
        if (!mutation) throw new BusinessError(400, `Barang ID ${productId} tidak ditemukan`);
      }

      const detailPlaceholders = details.map(() => '(?, ?, ?, ?, ?, NULL, ?, ?)').join(', ');
      const detailArgs = details.flatMap(detail => [
        saleId,
        detail.barang_id,
        detail.nama,
        detail.quantity,
        detail.harga,
        now,
        jenisHarga
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
        SELECT id, barang_id, barang, quantity, harga, total, tanggal, jenis_harga
        FROM pemasukan WHERE id = ? AND penjualan_id IS NULL
      `, [id]);
      if (!item) return fail(res, 404, 'Penjualan tidak ditemukan');
      return success(res, {
        id: item.id,
        nomor_nota: `LAMA-${item.id}`,
        jenis_harga: item.jenis_harga === 'grosir' ? 'grosir' : 'retail',
        total: item.total,
        tanggal: item.tanggal,
        legacy: true,
        items: [item]
      });
    }

    const header = await getOne(`
      SELECT id, nomor_nota, jenis_harga, total, tanggal, voided_at, void_reason
      FROM penjualan WHERE id = ?
    `, [id]);
    if (!header) return fail(res, 404, 'Penjualan tidak ditemukan');
    const details = await getAll(`
      SELECT id, barang_id, barang, quantity, harga, total
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

      // Detail yang belum dibatalkan dipakai untuk mengembalikan stok.
      const detailsResult = await transaction.execute({
        sql: 'SELECT id, barang_id, quantity FROM pemasukan WHERE penjualan_id = ? AND voided_at IS NULL',
        args: [id]
      });
      const details = detailsResult.rows;

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

      let stokDikembalikan = 0;
      const qtyByProduct = new Map();
      for (const detail of details) {
        if (detail.barang_id == null) continue;
        qtyByProduct.set(detail.barang_id, (qtyByProduct.get(detail.barang_id) || 0) + detail.quantity);
      }
      for (const [productId, qty] of qtyByProduct) {
        const mutation = await updateStockWithMutation(transaction, {
          barangId: productId,
          mode: 'delta',
          amount: qty,
          type: 'batal_penjualan',
          referenceId: id,
          note: reason,
          timestamp: now
        });
        if (!mutation) throw new BusinessError(400, `Barang ID ${productId} tidak ditemukan`);
        stokDikembalikan += 1;
      }
      return { voided: true, already_voided: false, stok_dikembalikan: stokDikembalikan };
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
