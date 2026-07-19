const express = require('express');
const { getAll, getOne, run } = require('../db/query');
const { success, fail } = require('../utils/response');
const { ValidationError, requireString, requirePositiveId } = require('../utils/validate');
const { getNowWib } = require('../utils/date');

const router = express.Router();
const VALID_STATUSES = new Set(['aktif', 'arsip', 'semua']);
const PUBLIC_COLUMNS = 'id, nama, aktif, created_at, updated_at, archived_at';

function normalizeName(value) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('id-ID');
}

function parseName(value) {
  const nama = requireString(value, 'Nama salesman').replace(/\s+/g, ' ');
  if (nama.length > 100) throw new ValidationError('Nama salesman maksimal 100 karakter');
  return { nama, normalized: normalizeName(nama) };
}

function isUniqueError(err) {
  return String(err?.message || '').toLowerCase().includes('unique');
}

router.get('/', async (req, res) => {
  try {
    const status = req.query.status === undefined ? 'aktif' : req.query.status;
    if (typeof status !== 'string' || !VALID_STATUSES.has(status)) {
      throw new ValidationError('Status salesman tidak valid');
    }
    const search = req.query.q === undefined || req.query.q === ''
      ? ''
      : requireString(req.query.q, 'Pencarian');
    if (search.length > 100) throw new ValidationError('Pencarian maksimal 100 karakter');

    const conditions = [];
    const params = [];
    if (status === 'aktif') conditions.push('aktif = 1');
    if (status === 'arsip') conditions.push('aktif = 0');
    if (search) {
      conditions.push('instr(nama_normalized, ?) > 0');
      params.push(normalizeName(search));
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const items = await getAll(`
      SELECT ${PUBLIC_COLUMNS}
      FROM master_salesman
      ${where}
      ORDER BY aktif DESC, nama COLLATE NOCASE ASC
    `, params);
    return success(res, items);
  } catch (err) {
    if (err instanceof ValidationError) return fail(res, 400, err.message);
    console.error(err);
    return fail(res, 500, 'Gagal mengambil master salesman');
  }
});

router.post('/', async (req, res) => {
  try {
    const value = parseName(req.body?.nama);
    const now = getNowWib();
    const info = await run(`
      INSERT INTO master_salesman (nama, nama_normalized, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `, [value.nama, value.normalized, now, now]);

    const created = await getOne(`SELECT ${PUBLIC_COLUMNS} FROM master_salesman WHERE id = ?`, [info.lastInsertRowid]);
    return success(res, created, null, 201);
  } catch (err) {
    if (err instanceof ValidationError) return fail(res, 400, err.message);
    if (isUniqueError(err)) return fail(res, 409, 'Nama salesman sudah terdaftar');
    console.error(err);
    return fail(res, 500, 'Gagal menyimpan salesman');
  }
});

router.put('/:id', async (req, res) => {
  try {
    const id = requirePositiveId(req.params.id);
    const value = parseName(req.body?.nama);
    const existing = await getOne('SELECT id FROM master_salesman WHERE id = ?', [id]);
    if (!existing) return fail(res, 404, 'ID tidak ditemukan');

    await run(`
      UPDATE master_salesman
      SET nama = ?, nama_normalized = ?, updated_at = ?
      WHERE id = ?
    `, [value.nama, value.normalized, getNowWib(), id]);
    const updated = await getOne(`SELECT ${PUBLIC_COLUMNS} FROM master_salesman WHERE id = ?`, [id]);
    return success(res, updated);
  } catch (err) {
    if (err instanceof ValidationError) return fail(res, 400, err.message);
    if (isUniqueError(err)) return fail(res, 409, 'Nama salesman sudah terdaftar');
    console.error(err);
    return fail(res, 500, 'Gagal memperbarui salesman');
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = requirePositiveId(req.params.id);
    const existing = await getOne('SELECT id, aktif FROM master_salesman WHERE id = ?', [id]);
    if (!existing) return fail(res, 404, 'ID tidak ditemukan');
    if (!existing.aktif) return success(res, { archived: true, already_archived: true });

    const now = getNowWib();
    await run(`
      UPDATE master_salesman
      SET aktif = 0, archived_at = ?, updated_at = ?
      WHERE id = ? AND aktif = 1
    `, [now, now, id]);
    return success(res, { archived: true, already_archived: false });
  } catch (err) {
    if (err instanceof ValidationError) return fail(res, 400, err.message);
    console.error(err);
    return fail(res, 500, 'Gagal mengarsipkan salesman');
  }
});

router.post('/:id/aktifkan', async (req, res) => {
  try {
    const id = requirePositiveId(req.params.id);
    const existing = await getOne('SELECT id, aktif FROM master_salesman WHERE id = ?', [id]);
    if (!existing) return fail(res, 404, 'ID tidak ditemukan');
    if (existing.aktif) return success(res, { active: true, already_active: true });

    await run(`
      UPDATE master_salesman
      SET aktif = 1, archived_at = NULL, updated_at = ?
      WHERE id = ? AND aktif = 0
    `, [getNowWib(), id]);
    return success(res, { active: true, already_active: false });
  } catch (err) {
    if (err instanceof ValidationError) return fail(res, 400, err.message);
    console.error(err);
    return fail(res, 500, 'Gagal mengaktifkan salesman');
  }
});

module.exports = router;
