const express = require('express');
const { getAll, getOne, run, batch } = require('../db/query');
const { success, fail } = require('../utils/response');
const { requireString, requirePositiveInteger, optionalString } = require('../utils/validate');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const status = req.query.status || 'belum_lunas';
    let sql = 'SELECT * FROM kasbon';
    const params = [];

    if (status === 'belum_lunas' || status === 'lunas') {
      sql += ' WHERE status = ?';
      params.push(status);
    }

    sql += ' ORDER BY tanggal DESC';

    const items = await getAll(sql, params);
    return success(res, items);
  } catch (err) {
    console.error(err);
    return fail(res, 500, 'Gagal mengambil data kasbon');
  }
});

router.post('/', async (req, res) => {
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

    const now = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).replace(' ', ' ');
    const info = await run(`
      INSERT INTO kasbon (nama, nominal, sisa, keterangan, tanggal)
      VALUES (?, ?, ?, ?, ?)
    `, [nama, nominal, nominal, keterangan, now]);

    const created = await getOne('SELECT * FROM kasbon WHERE id = ?', [info.lastInsertRowid]);
    return success(res, created);
  } catch (err) {
    if (err.message.includes('wajib') || err.message.includes('positif') || err.message.includes('karakter')) {
      return fail(res, 400, err.message);
    }
    console.error(err);
    return fail(res, 500, 'Gagal menyimpan kasbon');
  }
});

router.post('/:id/bayar', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return fail(res, 400, 'ID tidak valid');

    const bayar = requirePositiveInteger(req.body?.bayar, 'Bayar');

    const kasbon = await getOne('SELECT * FROM kasbon WHERE id = ?', [id]);
    if (!kasbon) return fail(res, 404, 'ID tidak ditemukan');
    if (kasbon.status === 'lunas') return fail(res, 400, 'Kasbon sudah lunas');
    if (bayar > kasbon.sisa) return fail(res, 400, 'Jumlah bayar melebihi sisa');

    const updateSisa = kasbon.sisa - bayar;
    const newStatus = updateSisa <= 0 ? 'lunas' : 'belum_lunas';
    const finalSisa = Math.max(0, updateSisa);

    const now = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).replace(' ', ' ');

    await batch([
      { sql: 'UPDATE kasbon SET sisa = ?, status = ? WHERE id = ?', args: [finalSisa, newStatus, id] },
      { sql: 'INSERT INTO kasbon_bayar (kasbon_id, bayar, tanggal) VALUES (?, ?, ?)', args: [id, bayar, now] }
    ]);

    const updatedKasbon = await getOne('SELECT * FROM kasbon WHERE id = ?', [id]);
    const pembayaran = await getOne('SELECT * FROM kasbon_bayar WHERE kasbon_id = ? ORDER BY id DESC LIMIT 1', [id]);

    return success(res, { kasbon: updatedKasbon, pembayaran });
  } catch (err) {
    if (err.message.includes('wajib') || err.message.includes('positif')) {
      return fail(res, 400, err.message);
    }
    console.error(err);
    return fail(res, 500, 'Gagal memproses pembayaran');
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return fail(res, 400, 'ID tidak valid');

    const existing = await getOne('SELECT id FROM kasbon WHERE id = ?', [id]);
    if (!existing) return fail(res, 404, 'ID tidak ditemukan');

    await run('DELETE FROM kasbon WHERE id = ?', [id]);
    return success(res, { deleted: true });
  } catch (err) {
    console.error(err);
    return fail(res, 500, 'Gagal menghapus kasbon');
  }
});

module.exports = router;
