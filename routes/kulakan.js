const crypto = require('crypto');
const express = require('express');
const { getAll, getOne, withWriteTransaction } = require('../db/query');
const { success, fail } = require('../utils/response');
const { updateStockWithMutation } = require('../utils/stock');
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

class BusinessError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function parseItems(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ValidationError('Kulakan minimal memiliki satu barang');
  }
  if (value.length > 30) throw new ValidationError('Maksimal 30 baris barang per kulakan');

  return value.map((item, index) => {
    const barangId = requirePositiveId(item?.barang_id);
    const quantity = requirePositiveInteger(item?.quantity, `Quantity baris ${index + 1}`);
    const hargaBeli = requirePositiveInteger(item?.harga_beli, `Harga beli baris ${index + 1}`);
    if (!Number.isSafeInteger(quantity * hargaBeli)) {
      throw new ValidationError(`Subtotal barang baris ${index + 1} terlalu besar`);
    }
    return { barang_id: barangId, quantity, harga_beli: hargaBeli };
  });
}

function hashPayload(salesmanId, items) {
  return crypto.createHash('sha256').update(JSON.stringify({ salesman_id: salesmanId, items })).digest('hex');
}

async function getPurchase(transaction, id) {
  const headerResult = await transaction.execute({
    sql: `
      SELECT id, nomor_kulakan, salesman_id, salesman_nama, total, tanggal, voided_at, void_reason
      FROM kulakan WHERE id = ?
    `,
    args: [id]
  });
  const header = headerResult.rows[0] || null;
  if (!header) return null;
  const itemResult = await transaction.execute({
    sql: `
      SELECT id, barang_id, barang_nama, quantity, harga_beli, total
      FROM kulakan_item WHERE kulakan_id = ? ORDER BY id
    `,
    args: [id]
  });
  return { ...header, items: itemResult.rows };
}

router.get('/', async (req, res) => {
  try {
    const range = requireDateRange(req.query.dari, req.query.sampai, getTodayWib());
    const items = await getAll(`
      SELECT
        k.id, k.nomor_kulakan, k.salesman_id, k.salesman_nama,
        k.total, k.tanggal, COUNT(i.id) AS jumlah_item
      FROM kulakan k
      JOIN kulakan_item i ON i.kulakan_id = k.id
      WHERE k.voided_at IS NULL AND date(k.tanggal) BETWEEN :dari AND :sampai
      GROUP BY k.id
      ORDER BY k.tanggal DESC, k.id DESC
    `, { dari: range.dari, sampai: range.sampai });
    return success(res, items);
  } catch (err) {
    if (err instanceof ValidationError) return fail(res, 400, err.message);
    console.error(err);
    return fail(res, 500, 'Gagal mengambil data kulakan');
  }
});

router.post('/', async (req, res) => {
  try {
    const salesmanId = requirePositiveId(req.body?.salesman_id);
    const parsedItems = parseItems(req.body?.items);
    const requestId = optionalRequestId(req.get('Idempotency-Key'));
    const payloadHash = hashPayload(salesmanId, parsedItems);
    const now = getNowWib();

    const purchase = await withWriteTransaction(async (transaction) => {
      if (requestId) {
        const replayResult = await transaction.execute({
          sql: 'SELECT id, payload_hash FROM kulakan WHERE request_id = ?',
          args: [requestId]
        });
        const replay = replayResult.rows[0] || null;
        if (replay) {
          if (replay.payload_hash !== payloadHash) {
            throw new BusinessError(409, 'Idempotency-Key sudah dipakai untuk kulakan berbeda');
          }
          return getPurchase(transaction, replay.id);
        }
      }

      const salesmanResult = await transaction.execute({
        sql: 'SELECT id, nama FROM master_salesman WHERE id = ? AND aktif = 1',
        args: [salesmanId]
      });
      const salesman = salesmanResult.rows[0] || null;
      if (!salesman) throw new BusinessError(400, 'Salesman tidak ditemukan atau diarsipkan');

      const productIds = [...new Set(parsedItems.map(item => item.barang_id))];
      const productResult = await transaction.execute({
        sql: `
          SELECT id, nama FROM master_barang
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
        total += item.quantity * item.harga_beli;
        if (!Number.isSafeInteger(total)) throw new BusinessError(400, 'Total kulakan terlalu besar');
        details.push({ ...item, barang_nama: product.nama });
      }

      const temporaryNumber = `TMP-${requestId || crypto.randomUUID()}`;
      const insertHeader = await transaction.execute({
        sql: `
          INSERT INTO kulakan
            (nomor_kulakan, salesman_id, salesman_nama, total, tanggal, request_id, payload_hash)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        args: [temporaryNumber, salesmanId, salesman.nama, total, now, requestId, payloadHash]
      });
      const purchaseId = Number(insertHeader.lastInsertRowid);
      const purchaseNumber = `KL-${now.slice(0, 10).replace(/-/g, '')}-${String(purchaseId).padStart(6, '0')}`;
      await transaction.execute({
        sql: 'UPDATE kulakan SET nomor_kulakan = ? WHERE id = ?',
        args: [purchaseNumber, purchaseId]
      });

      const placeholders = details.map(() => '(?, ?, ?, ?, ?)').join(', ');
      const args = details.flatMap(detail => [
        purchaseId,
        detail.barang_id,
        detail.barang_nama,
        detail.quantity,
        detail.harga_beli
      ]);
      await transaction.execute({
        sql: `
          INSERT INTO kulakan_item
            (kulakan_id, barang_id, barang_nama, quantity, harga_beli)
          VALUES ${placeholders}
        `,
        args
      });

      // Stok: tambahkan ke master_barang dan tulis satu ledger agregat per
      // barang dalam transaksi yang sama.
      const qtyByProduct = new Map();
      for (const detail of details) {
        qtyByProduct.set(detail.barang_id, (qtyByProduct.get(detail.barang_id) || 0) + detail.quantity);
      }
      for (const [productId, qty] of qtyByProduct) {
        const mutation = await updateStockWithMutation(transaction, {
          barangId: productId,
          mode: 'delta',
          amount: qty,
          type: 'kulakan',
          referenceId: purchaseId,
          timestamp: now
        });
        if (!mutation) throw new BusinessError(400, `Barang ID ${productId} tidak ditemukan`);
      }

      return getPurchase(transaction, purchaseId);
    });

    return success(res, purchase, null, 201);
  } catch (err) {
    if (err instanceof ValidationError) return fail(res, 400, err.message);
    if (err instanceof BusinessError) return fail(res, err.status, err.message);
    console.error(err);
    return fail(res, 500, 'Gagal menyimpan kulakan');
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = requirePositiveId(req.params.id);
    const header = await getOne(`
      SELECT id, nomor_kulakan, salesman_id, salesman_nama, total, tanggal, voided_at, void_reason
      FROM kulakan WHERE id = ?
    `, [id]);
    if (!header) return fail(res, 404, 'Kulakan tidak ditemukan');
    const items = await getAll(`
      SELECT id, barang_id, barang_nama, quantity, harga_beli, total
      FROM kulakan_item WHERE kulakan_id = ? ORDER BY id
    `, [id]);
    return success(res, { ...header, items });
  } catch (err) {
    if (err instanceof ValidationError) return fail(res, 400, err.message);
    console.error(err);
    return fail(res, 500, 'Gagal mengambil detail kulakan');
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = requirePositiveId(req.params.id);
    const reason = optionalString(req.body?.reason, 'Alasan pembatalan') || 'Dibatalkan oleh admin';
    if (reason.length > 200) return fail(res, 400, 'Alasan pembatalan maksimal 200 karakter');

    const now = getNowWib();

    const result = await withWriteTransaction(async (transaction) => {
      const current = await transaction.execute({
        sql: 'SELECT id, voided_at FROM kulakan WHERE id = ?',
        args: [id]
      });
      const purchase = current.rows[0] || null;
      if (!purchase) throw new BusinessError(404, 'Kulakan tidak ditemukan');
      if (purchase.voided_at) return { voided: true, already_voided: true };

      const itemResult = await transaction.execute({
        sql: 'SELECT id, barang_id, quantity FROM kulakan_item WHERE kulakan_id = ?',
        args: [id]
      });
      const items = itemResult.rows;

      await transaction.execute({
        sql: 'UPDATE kulakan SET voided_at = ?, void_reason = ? WHERE id = ?',
        args: [now, reason, id]
      });

      // Membalik efek stok kulakan dan tulis ledger batal_kulakan. Stok boleh
      // minus jika barang sudah terjual (kasus langka); kasir bisa perbaiki
      // via opname.
      const qtyByProduct = new Map();
      for (const item of items) {
        if (item.barang_id == null) continue;
        qtyByProduct.set(item.barang_id, (qtyByProduct.get(item.barang_id) || 0) + item.quantity);
      }
      for (const [productId, qty] of qtyByProduct) {
        const mutation = await updateStockWithMutation(transaction, {
          barangId: productId,
          mode: 'delta',
          amount: -qty,
          type: 'batal_kulakan',
          referenceId: id,
          note: reason,
          timestamp: now
        });
        if (!mutation) throw new BusinessError(400, `Barang ID ${productId} tidak ditemukan`);
      }
      return { voided: true, already_voided: false };
    });
    return success(res, result);
  } catch (err) {
    if (err instanceof ValidationError) return fail(res, 400, err.message);
    if (err instanceof BusinessError) return fail(res, err.status, err.message);
    console.error(err);
    return fail(res, 500, 'Gagal membatalkan kulakan');
  }
});

module.exports = router;
