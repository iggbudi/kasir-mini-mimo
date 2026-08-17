const express = require('express');
const { getAll, getOne, run, withWriteTransaction } = require('../db/query');
const { success, fail } = require('../utils/response');
const {
  ValidationError,
  requireString,
  requirePositiveInteger,
  optionalPositiveInteger,
  requireNonNegativeInteger,
  requirePositiveId,
  optionalString
} = require('../utils/validate');
const { getNowWib } = require('../utils/date');
const { STOCK_CONDITIONS, classifyStock, updateStockWithMutation } = require('../utils/stock');

const router = express.Router();
const VALID_STATUSES = new Set(['aktif', 'arsip', 'semua']);
const PUBLIC_COLUMNS = `
  id, nama, harga_retail, harga_grosir, stok,
  aktif, created_at, updated_at, archived_at
`;

class BusinessError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function normalizeName(value) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('id-ID');
}

function parseProduct(body) {
  const nama = requireString(body?.nama, 'Nama barang').replace(/\s+/g, ' ');
  const hargaRetail = requirePositiveInteger(body?.harga_retail, 'Harga retail');
  const hargaGrosir = optionalPositiveInteger(body?.harga_grosir, 'Harga grosir');

  if (nama.length > 100) throw new ValidationError('Nama barang maksimal 100 karakter');
  if (hargaGrosir !== null && hargaGrosir > hargaRetail) {
    throw new ValidationError('Harga grosir tidak boleh lebih besar dari harga retail');
  }

  return {
    nama,
    namaNormalized: normalizeName(nama),
    hargaRetail,
    hargaGrosir
  };
}

function isUniqueError(err) {
  return String(err?.message || '').toLowerCase().includes('unique');
}

router.get('/', async (req, res) => {
  try {
    const status = req.query.status === undefined ? 'aktif' : req.query.status;
    if (typeof status !== 'string' || !VALID_STATUSES.has(status)) {
      throw new ValidationError('Status barang tidak valid');
    }
    const search = req.query.q === undefined || req.query.q === ''
      ? ''
      : requireString(req.query.q, 'Pencarian');
    if (search.length > 100) throw new ValidationError('Pencarian maksimal 100 karakter');
    const stockCondition = req.query.kondisi_stok === undefined ? 'semua' : req.query.kondisi_stok;
    if (typeof stockCondition !== 'string' || !STOCK_CONDITIONS.has(stockCondition)) {
      throw new ValidationError('Kondisi stok tidak valid');
    }
    const setting = await getOne("SELECT value FROM setting WHERE key = 'stok_minimum'");
    const stockMinimum = Number(setting?.value || 5);

    const conditions = [];
    const params = [];
    if (status === 'aktif') conditions.push('aktif = 1');
    if (status === 'arsip') conditions.push('aktif = 0');
    if (search) {
      conditions.push('instr(nama_normalized, ?) > 0');
      params.push(normalizeName(search));
    }
    if (stockCondition === 'minus') conditions.push('stok < 0');
    if (stockCondition === 'habis') conditions.push('stok = 0');
    if (stockCondition === 'menipis') {
      conditions.push('stok >= 1 AND stok <= ?');
      params.push(stockMinimum);
    }
    if (stockCondition === 'aman') {
      conditions.push('stok > ?');
      params.push(stockMinimum);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const items = await getAll(`
      SELECT ${PUBLIC_COLUMNS}
      FROM master_barang
      ${where}
      ORDER BY aktif DESC, nama COLLATE NOCASE ASC
    `, params);
    return success(res, items.map(item => ({
      ...item,
      kondisi_stok: classifyStock(Number(item.stok || 0), stockMinimum)
    })));
  } catch (err) {
    if (err instanceof ValidationError) return fail(res, 400, err.message);
    console.error(err);
    return fail(res, 500, 'Gagal mengambil master barang');
  }
});

router.get('/stok-config', async (_req, res) => {
  try {
    const row = await getOne("SELECT value FROM setting WHERE key = 'stok_minimum'");
    return success(res, { stok_minimum: Number(row?.value || 5) });
  } catch (err) {
    console.error(err);
    return fail(res, 500, 'Gagal mengambil batas stok minimum');
  }
});

router.put('/stok-config', async (req, res) => {
  try {
    const minimum = requirePositiveInteger(req.body?.stok_minimum, 'Batas stok minimum');
    await run(
      'INSERT INTO setting (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      ['stok_minimum', String(minimum)]
    );
    return success(res, { stok_minimum: minimum });
  } catch (err) {
    if (err instanceof ValidationError) return fail(res, 400, err.message);
    console.error(err);
    return fail(res, 500, 'Gagal memperbarui batas stok minimum');
  }
});

router.post('/', async (req, res) => {
  try {
    const product = parseProduct(req.body);
    const now = getNowWib();
    const info = await run(`
      INSERT INTO master_barang
        (nama, nama_normalized, harga_retail, harga_grosir, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      product.nama,
      product.namaNormalized,
      product.hargaRetail,
      product.hargaGrosir,
      now,
      now
    ]);

    const created = await getOne(`SELECT ${PUBLIC_COLUMNS} FROM master_barang WHERE id = ?`, [info.lastInsertRowid]);
    return success(res, created, null, 201);
  } catch (err) {
    if (err instanceof ValidationError) return fail(res, 400, err.message);
    if (isUniqueError(err)) return fail(res, 409, 'Nama barang sudah terdaftar');
    console.error(err);
    return fail(res, 500, 'Gagal menyimpan barang');
  }
});

router.put('/:id', async (req, res) => {
  try {
    const id = requirePositiveId(req.params.id);
    const product = parseProduct(req.body);
    const existing = await getOne('SELECT id FROM master_barang WHERE id = ?', [id]);
    if (!existing) return fail(res, 404, 'ID tidak ditemukan');

    await run(`
      UPDATE master_barang
      SET nama = ?, nama_normalized = ?, harga_retail = ?, harga_grosir = ?,
          updated_at = ?
      WHERE id = ?
    `, [
      product.nama,
      product.namaNormalized,
      product.hargaRetail,
      product.hargaGrosir,
      getNowWib(),
      id
    ]);

    const updated = await getOne(`SELECT ${PUBLIC_COLUMNS} FROM master_barang WHERE id = ?`, [id]);
    return success(res, updated);
  } catch (err) {
    if (err instanceof ValidationError) return fail(res, 400, err.message);
    if (isUniqueError(err)) return fail(res, 409, 'Nama barang sudah terdaftar');
    console.error(err);
    return fail(res, 500, 'Gagal memperbarui barang');
  }
});

// Opname / penyesuaian stok manual dengan riwayat.
router.put('/:id/stok', async (req, res) => {
  try {
    const id = requirePositiveId(req.params.id);
    const stok = requireNonNegativeInteger(req.body?.stok, 'Stok');
    const catatan = optionalString(req.body?.catatan, 'Catatan opname');
    if (catatan && catatan.length > 200) throw new ValidationError('Catatan opname maksimal 200 karakter');
    const now = getNowWib();

    const result = await withWriteTransaction(async (transaction) => {
      const mutation = await updateStockWithMutation(transaction, {
        barangId: id,
        mode: 'set',
        amount: stok,
        type: 'opname',
        note: catatan,
        timestamp: now
      });
      if (!mutation) throw new BusinessError(404, 'ID tidak ditemukan');

      await transaction.execute({
        sql: 'INSERT INTO stok_adjustment (barang_id, stok_sebelum, stok_sesudah, catatan) VALUES (?, ?, ?, ?)',
        args: [id, mutation.stok_sebelum, mutation.stok_sesudah, catatan]
      });
      return { id, stok_sebelum: mutation.stok_sebelum, stok_sesudah: mutation.stok_sesudah, catatan };
    });

    return success(res, result);
  } catch (err) {
    if (err instanceof ValidationError) return fail(res, 400, err.message);
    if (err instanceof BusinessError) return fail(res, err.status, err.message);
    console.error(err);
    return fail(res, 500, 'Gagal memperbarui stok');
  }
});

router.get('/:id/mutasi', async (req, res) => {
  try {
    const id = requirePositiveId(req.params.id);
    const limit = req.query.limit === undefined ? 20 : requirePositiveInteger(req.query.limit, 'Limit');
    const offset = req.query.offset === undefined ? 0 : requireNonNegativeInteger(req.query.offset, 'Offset');
    if (limit > 100) throw new ValidationError('Limit maksimal 100');

    const existing = await getOne('SELECT id FROM master_barang WHERE id = ?', [id]);
    if (!existing) return fail(res, 404, 'ID tidak ditemukan');

    const rows = await getAll(`
      SELECT
        m.id, m.barang_id, m.tipe, m.perubahan, m.stok_sebelum,
        m.stok_sesudah, m.referensi_id, m.catatan, m.tanggal,
        CASE
          WHEN m.tipe IN ('penjualan', 'batal_penjualan') THEN p.nomor_nota
          WHEN m.tipe IN ('kulakan', 'batal_kulakan') THEN k.nomor_kulakan
          ELSE NULL
        END AS nomor_referensi
      FROM stok_mutation m
      LEFT JOIN penjualan p
        ON m.tipe IN ('penjualan', 'batal_penjualan') AND p.id = m.referensi_id
      LEFT JOIN kulakan k
        ON m.tipe IN ('kulakan', 'batal_kulakan') AND k.id = m.referensi_id
      WHERE m.barang_id = ?
      ORDER BY m.tanggal DESC, m.id DESC
      LIMIT ? OFFSET ?
    `, [id, limit + 1, offset]);
    const hasMore = rows.length > limit;
    if (hasMore) rows.pop();
    return success(res, {
      items: rows,
      pagination: { limit, offset, has_more: hasMore }
    });
  } catch (err) {
    if (err instanceof ValidationError) return fail(res, 400, err.message);
    console.error(err);
    return fail(res, 500, 'Gagal mengambil riwayat mutasi stok');
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = requirePositiveId(req.params.id);
    const existing = await getOne('SELECT id, aktif FROM master_barang WHERE id = ?', [id]);
    if (!existing) return fail(res, 404, 'ID tidak ditemukan');
    if (!existing.aktif) return success(res, { archived: true, already_archived: true });

    const now = getNowWib();
    await run(`
      UPDATE master_barang
      SET aktif = 0, archived_at = ?, updated_at = ?
      WHERE id = ? AND aktif = 1
    `, [now, now, id]);
    return success(res, { archived: true, already_archived: false });
  } catch (err) {
    if (err instanceof ValidationError) return fail(res, 400, err.message);
    console.error(err);
    return fail(res, 500, 'Gagal mengarsipkan barang');
  }
});

router.post('/:id/aktifkan', async (req, res) => {
  try {
    const id = requirePositiveId(req.params.id);
    const existing = await getOne('SELECT id, aktif FROM master_barang WHERE id = ?', [id]);
    if (!existing) return fail(res, 404, 'ID tidak ditemukan');
    if (existing.aktif) return success(res, { active: true, already_active: true });

    await run(`
      UPDATE master_barang
      SET aktif = 1, archived_at = NULL, updated_at = ?
      WHERE id = ? AND aktif = 0
    `, [getNowWib(), id]);
    return success(res, { active: true, already_active: false });
  } catch (err) {
    if (err instanceof ValidationError) return fail(res, 400, err.message);
    console.error(err);
    return fail(res, 500, 'Gagal mengaktifkan barang');
  }
});

module.exports = router;
