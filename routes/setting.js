const express = require('express');
const db = require('../db/connection');
const { success, fail } = require('../utils/response');
const { requireString } = require('../utils/validate');

const router = express.Router();

/**
 * GET /api/setting
 * Mengembalikan setting saat ini (nama_warung & timezone)
 */
router.get('/', (_req, res) => {
  try {
    const rows = db.prepare('SELECT key, value FROM setting').all();
    const settings = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }

    return success(res, {
      nama_warung: settings.nama_warung || 'Warung Saya',
      timezone: settings.timezone || 'Asia/Jakarta'
    });
  } catch (err) {
    console.error(err);
    return fail(res, 500, 'Gagal mengambil pengaturan');
  }
});

/**
 * PUT /api/setting
 * Body: { nama_warung }
 */
router.put('/', (req, res) => {
  try {
    const namaWarung = requireString(req.body?.nama_warung, 'Nama warung');

    db.prepare('UPDATE setting SET value = ? WHERE key = ?').run(namaWarung, 'nama_warung');

    // Kembalikan data terbaru
    const rows = db.prepare('SELECT key, value FROM setting').all();
    const settings = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }

    return success(res, {
      nama_warung: settings.nama_warung || namaWarung,
      timezone: settings.timezone || 'Asia/Jakarta'
    });
  } catch (err) {
    if (err.message.includes('wajib diisi') || err.message.includes('harus')) {
      return fail(res, 400, err.message);
    }
    console.error(err);
    return fail(res, 500, 'Gagal memperbarui pengaturan');
  }
});

module.exports = router;
