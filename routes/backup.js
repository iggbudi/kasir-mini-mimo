const express = require('express');
const fs = require('fs');
const path = require('path');
const { fail } = require('../utils/response');

const router = express.Router();

router.get('/', (_req, res) => {
  try {
    const dbPath = path.join(__dirname, '../db/kasir.db');
    if (!fs.existsSync(dbPath)) {
      return fail(res, 404, 'Database tidak ditemukan');
    }

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `kasir-backup-${dateStr}.db`;

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/octet-stream');

    const fileStream = fs.createReadStream(dbPath);
    fileStream.pipe(res);
  } catch (err) {
    console.error(err);
    return fail(res, 500, 'Gagal membuat backup');
  }
});

module.exports = router;
