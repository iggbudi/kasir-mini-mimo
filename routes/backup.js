const crypto = require('crypto');
const express = require('express');
const { batch } = require('../db/query');
const { fail } = require('../utils/response');
const { getTodayWib } = require('../utils/date');

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const results = await batch([
      'SELECT COALESCE(MAX(version), 0) AS version FROM schema_migration',
      'SELECT * FROM pemasukan ORDER BY id',
      'SELECT * FROM pengeluaran ORDER BY id',
      'SELECT * FROM kasbon ORDER BY id',
      'SELECT * FROM kasbon_bayar ORDER BY id',
      'SELECT * FROM setting ORDER BY key',
      'SELECT * FROM master_barang ORDER BY id'
    ], 'read');

    const schemaVersion = Number(results[0].rows[0]?.version || 0);
    const toPlainRows = result => result.rows.map(row => ({ ...row }));
    const pemasukan = toPlainRows(results[1]);
    const pengeluaran = toPlainRows(results[2]);
    const kasbon = toPlainRows(results[3]);
    const kasbonBayar = toPlainRows(results[4]);
    const settings = toPlainRows(results[5]);
    const masterBarang = toPlainRows(results[6]);
    const data = {
      pemasukan,
      pengeluaran,
      kasbon,
      kasbon_bayar: kasbonBayar,
      setting: settings,
      master_barang: masterBarang
    };
    const checksum = crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');

    const backup = {
      format: 'kasir-mini-backup',
      schema_version: schemaVersion,
      exported_at: new Date().toISOString(),
      timezone: 'Asia/Jakarta',
      counts: {
        pemasukan: pemasukan.length,
        pengeluaran: pengeluaran.length,
        kasbon: kasbon.length,
        kasbon_bayar: kasbonBayar.length,
        setting: settings.length,
        master_barang: masterBarang.length
      },
      checksum_sha256: checksum,
      ...data
    };

    const filename = `kasir-backup-${getTodayWib().replace(/-/g, '')}.json`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    return res.json(backup);
  } catch (err) {
    console.error(err);
    return fail(res, 500, 'Gagal membuat backup');
  }
});

module.exports = router;
