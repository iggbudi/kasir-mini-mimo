const express = require('express');
const db = require('../db/connection');
const { success, fail } = require('../utils/response');
const { requireString, requirePositiveInteger, optionalString } = require('../utils/validate');

const router = express.Router();

/**
 * GET /api/kasbon?status=
 */
router.get('/', (req, res) => {
  try {
    const status = req.query.status || 'belum_lunas';
    let sql = 'SELECT * FROM kasbon';
    const params = [];

    if (status === 'belum_lunas' || status === 'lunas') {
      sql += ' WHERE status = ?';
      params.push(status);
    }
    // 'semua' => no filter

    sql += ' ORDER BY tanggal DESC';

    const items = db.prepare(sql).all(...params);
    return success(res, items);
  } catch (err) {
    console.error(err);
    return fail(res, 500, 'Gagal mengambil data kasbon');
  }
});

/**
 * POST /api/kasbon
 */
router.post('/', (req, res) => {
  try {
    const nama = requireString(req.body?.nama, 'Nama');
    const nominal = requirePositiveInteger(req.body?.nominal, 'Nominal');
    const keterangan = optionalString(req.body?.keterangan);

    if (nama.length > 50) {
      return fail(res, 400, 'Nama maksimal 50 karakter');
    }
    if (keterangan && keterangan.length > 200) {
      return fail(res, 400, 'Keterangan maksimal 200 karakter');
    }

    const info = db.prepare(`
      INSERT INTO kasbon (nama, nominal, sisa, keterangan)
      VALUES (?, ?, ?, ?)
    `).run(nama, nominal, nominal, keterangan);

    const created = db.prepare('SELECT * FROM kasbon WHERE id = ?').get(info.lastInsertRowid);
    return success(res, created);
  } catch (err) {
    if (err.message.includes('wajib') || err.message.includes('positif') || err.message.includes('karakter')) {
      return fail(res, 400, err.message);
    }
    console.error(err);
    return fail(res, 500, 'Gagal menyimpan kasbon');
  }
});

/**
 * POST /api/kasbon/:id/bayar
 */
router.post('/:id/bayar', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return fail(res, 400, 'ID tidak valid');

    const bayar = requirePositiveInteger(req.body?.bayar, 'Bayar');

    const kasbon = db.prepare('SELECT * FROM kasbon WHERE id = ?').get(id);
    if (!kasbon) return fail(res, 404, 'ID tidak ditemukan');
    if (kasbon.status === 'lunas') return fail(res, 400, 'Kasbon sudah lunas');
    if (bayar > kasbon.sisa) return fail(res, 400, 'Jumlah bayar melebihi sisa');

    const updateSisa = kasbon.sisa - bayar;
    const newStatus = updateSisa <= 0 ? 'lunas' : 'belum_lunas';
    const finalSisa = Math.max(0, updateSisa);

    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE kasbon 
        SET sisa = ?, status = ? 
        WHERE id = ?
      `).run(finalSisa, newStatus, id);

      const bayarInfo = db.prepare(`
        INSERT INTO kasbon_bayar (kasbon_id, bayar)
        VALUES (?, ?)
      `).run(id, bayar);

      const updatedKasbon = db.prepare('SELECT * FROM kasbon WHERE id = ?').get(id);
      const pembayaran = db.prepare('SELECT * FROM kasbon_bayar WHERE id = ?').get(bayarInfo.lastInsertRowid);

      return { kasbon: updatedKasbon, pembayaran };
    });

    const result = tx();
    return success(res, result);
  } catch (err) {
    if (err.message.includes('wajib') || err.message.includes('positif')) {
      return fail(res, 400, err.message);
    }
    console.error(err);
    return fail(res, 500, 'Gagal memproses pembayaran');
  }
});

/**
 * DELETE /api/kasbon/:id
 */
router.delete('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return fail(res, 400, 'ID tidak valid');

    const existing = db.prepare('SELECT id FROM kasbon WHERE id = ?').get(id);
    if (!existing) return fail(res, 404, 'ID tidak ditemukan');

    db.prepare('DELETE FROM kasbon WHERE id = ?').run(id);
    return success(res, { deleted: true });
  } catch (err) {
    console.error(err);
    return fail(res, 500, 'Gagal menghapus kasbon');
  }
});

module.exports = router;
