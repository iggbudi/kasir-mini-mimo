const express = require('express');
const { getAll, getOne, run } = require('../db/query');
const { success, fail } = require('../utils/response');
const { requireString, requirePositiveInteger, optionalString } = require('../utils/validate');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { dari, sampai } = req.query;
    let sql = 'SELECT * FROM pengeluaran';
    const params = [];

    if (dari && sampai) {
      sql += ' WHERE date(tanggal) BETWEEN ? AND ?';
      params.push(dari, sampai);
    } else {
      const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
      sql += ' WHERE date(tanggal) = ?';
      params.push(today);
    }

    sql += ' ORDER BY tanggal DESC';

    const items = await getAll(sql, params);
    return success(res, items);
  } catch (err) {
    console.error(err);
    return fail(res, 500, 'Gagal mengambil data pengeluaran');
  }
});

router.post('/', async (req, res) => {
  try {
    const keterangan = requireString(req.body?.keterangan, 'Keterangan');
    const nominal = requirePositiveInteger(req.body?.nominal, 'Nominal');
    const catatan = optionalString(req.body?.catatan);

    if (keterangan.length > 100) {
      return fail(res, 400, 'Keterangan maksimal 100 karakter');
    }
    if (catatan && catatan.length > 200) {
      return fail(res, 400, 'Catatan maksimal 200 karakter');
    }

    const now = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).replace(' ', ' ');
    const info = await run(`
      INSERT INTO pengeluaran (keterangan, nominal, catatan, tanggal)
      VALUES (?, ?, ?, ?)
    `, [keterangan, nominal, catatan, now]);

    const created = await getOne('SELECT * FROM pengeluaran WHERE id = ?', [info.lastInsertRowid]);
    return success(res, created);
  } catch (err) {
    if (err.message.includes('wajib') || err.message.includes('positif') || err.message.includes('karakter')) {
      return fail(res, 400, err.message);
    }
    console.error(err);
    return fail(res, 500, 'Gagal menyimpan pengeluaran');
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return fail(res, 400, 'ID tidak valid');

    const existing = await getOne('SELECT id FROM pengeluaran WHERE id = ?', [id]);
    if (!existing) return fail(res, 404, 'ID tidak ditemukan');

    await run('DELETE FROM pengeluaran WHERE id = ?', [id]);
    return success(res, { deleted: true });
  } catch (err) {
    console.error(err);
    return fail(res, 500, 'Gagal menghapus pengeluaran');
  }
});

module.exports = router;
