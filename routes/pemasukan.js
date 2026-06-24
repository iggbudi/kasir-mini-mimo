const express = require('express');
const db = require('../db/connection');
const { success, fail } = require('../utils/response');
const { requireString, requirePositiveInteger, optionalString } = require('../utils/validate');

const router = express.Router();

/**
 * GET /api/pemasukan?dari=&sampai=
 * Default: hari ini
 */
router.get('/', (req, res) => {
  try {
    const { dari, sampai } = req.query;
    let sql = 'SELECT * FROM pemasukan';
    const params = [];

    if (dari && sampai) {
      sql += ' WHERE date(tanggal) BETWEEN ? AND ?';
      params.push(dari, sampai);
    } else {
      sql += " WHERE date(tanggal) = date('now', 'localtime')";
    }

    sql += ' ORDER BY tanggal DESC';

    const items = db.prepare(sql).all(...params);
    return success(res, items);
  } catch (err) {
    console.error(err);
    return fail(res, 500, 'Gagal mengambil data pemasukan');
  }
});

/**
 * POST /api/pemasukan
 */
router.post('/', (req, res) => {
  try {
    const barang = requireString(req.body?.barang, 'Barang');
    const quantity = requirePositiveInteger(req.body?.quantity, 'Quantity');
    const harga = requirePositiveInteger(req.body?.harga, 'Harga');
    const catatan = optionalString(req.body?.catatan);

    if (barang.length > 100) {
      return fail(res, 400, 'Barang maksimal 100 karakter');
    }
    if (catatan && catatan.length > 200) {
      return fail(res, 400, 'Catatan maksimal 200 karakter');
    }

    const stmt = db.prepare(`
      INSERT INTO pemasukan (barang, quantity, harga, catatan)
      VALUES (?, ?, ?, ?)
    `);
    const info = stmt.run(barang, quantity, harga, catatan);

    const created = db.prepare('SELECT * FROM pemasukan WHERE id = ?').get(info.lastInsertRowid);
    return success(res, created);
  } catch (err) {
    if (err.message.includes('wajib') || err.message.includes('positif') || err.message.includes('karakter')) {
      return fail(res, 400, err.message);
    }
    console.error(err);
    return fail(res, 500, 'Gagal menyimpan pemasukan');
  }
});

/**
 * DELETE /api/pemasukan/:id
 */
router.delete('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return fail(res, 400, 'ID tidak valid');

    const existing = db.prepare('SELECT id FROM pemasukan WHERE id = ?').get(id);
    if (!existing) return fail(res, 404, 'ID tidak ditemukan');

    db.prepare('DELETE FROM pemasukan WHERE id = ?').run(id);
    return success(res, { deleted: true });
  } catch (err) {
    console.error(err);
    return fail(res, 500, 'Gagal menghapus pemasukan');
  }
});

module.exports = router;
