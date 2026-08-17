const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kasir-restore-'));
process.env.TURSO_DATABASE_URL = 'file:' + path.join(tmpDir, 'test.db');
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'admin123';

const { initDb } = require('../../db/init');
const { getOne, run } = require('../../db/query');
const { restoreBackup } = require('../../db/restore');

const V8_DATA_KEYS = [
  'pemasukan', 'pengeluaran', 'kasbon', 'kasbon_bayar', 'setting',
  'master_barang', 'penjualan', 'master_salesman', 'kulakan', 'kulakan_item',
  'stok_adjustment'
];
const V9_DATA_KEYS = [...V8_DATA_KEYS, 'stok_mutation'];
const checksum = data => crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');

test.before(async () => initDb());

test('restore backup v9 memulihkan ledger dan setting stok minimum', async () => {
  await run(`INSERT INTO master_barang
    (nama, nama_normalized, harga_retail, harga_grosir, stok, aktif, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, ['Barang', 'barang', 1000, null, 0, 1, '2026-01-01', '2026-01-01']);
  const data = Object.fromEntries(V9_DATA_KEYS.map(key => [key, []]));
  data.master_barang = [{
    id: 1, nama: 'Barang', nama_normalized: 'barang', harga_retail: 1000,
    harga_grosir: null, stok: 7, aktif: 1, created_at: '2026-01-01',
    updated_at: '2026-01-01', archived_at: null
  }];
  data.stok_mutation = [{
    id: 1, barang_id: 1, tipe: 'opname', perubahan: 7, stok_sebelum: 0,
    stok_sesudah: 7, referensi_id: null, catatan: null, tanggal: '2026-01-01'
  }];
  const backup = {
    format: 'kasir-mini-backup', schema_version: 9,
    counts: Object.fromEntries(V9_DATA_KEYS.map(key => [key, data[key].length])),
    checksum_sha256: checksum(data), ...data
  };

  await restoreBackup(backup);

  const restored = await getOne('SELECT tipe, perubahan, stok_sebelum, stok_sesudah FROM stok_mutation WHERE barang_id = 1');
  assert.deepEqual(restored, { tipe: 'opname', perubahan: 7, stok_sebelum: 0, stok_sesudah: 7 });
  const setting = await getOne("SELECT value FROM setting WHERE key = 'stok_minimum'");
  assert.equal(setting.value, '5');
});

test('restore backup v8 tanpa stok_mutation berhasil dengan ledger kosong', async () => {
  const data = Object.fromEntries(V8_DATA_KEYS.map(key => [key, []]));
  const backup = {
    format: 'kasir-mini-backup', schema_version: 8,
    counts: Object.fromEntries(V8_DATA_KEYS.map(key => [key, 0])),
    checksum_sha256: checksum(data), ...data
  };

  await restoreBackup(backup);

  assert.equal((await getOne('SELECT COUNT(*) AS count FROM stok_mutation')).count, 0);
});
