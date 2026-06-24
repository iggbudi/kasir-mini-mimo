const express = require('express');
const { getAll, run } = require('../db/query');
const { success, fail } = require('../utils/response');
const { requireString } = require('../utils/validate');

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const rows = await getAll('SELECT key, value FROM setting');
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

router.put('/', async (req, res) => {
  try {
    const namaWarung = requireString(req.body?.nama_warung, 'Nama warung');

    await run(
      'INSERT INTO setting (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      ['nama_warung', namaWarung]
    );

    const rows = await getAll('SELECT key, value FROM setting');
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
