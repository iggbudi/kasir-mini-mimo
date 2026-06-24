const express = require('express');
const { getAll } = require('../db/query');
const { success, fail } = require('../utils/response');

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const pemasukan = await getAll('SELECT * FROM pemasukan ORDER BY tanggal DESC');
    const pengeluaran = await getAll('SELECT * FROM pengeluaran ORDER BY tanggal DESC');
    const kasbon = await getAll('SELECT * FROM kasbon ORDER BY tanggal DESC');
    const kasbonBayar = await getAll('SELECT * FROM kasbon_bayar ORDER BY tanggal DESC');
    const settings = await getAll('SELECT * FROM setting');

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `kasir-backup-${dateStr}.json`;

    const backup = {
      exported_at: new Date().toISOString(),
      pemasukan,
      pengeluaran,
      kasbon,
      kasbon_bayar: kasbonBayar,
      setting: settings
    };

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json');
    return res.json(backup);
  } catch (err) {
    console.error(err);
    return fail(res, 500, 'Gagal membuat backup');
  }
});

module.exports = router;
