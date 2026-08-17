const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kasir-restore-mutation-'));
process.env.TURSO_DATABASE_URL = 'file:' + path.join(tmpDir, 'test.db');
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'admin123';

const { initDb } = require('../../db/init');
const { getOne, getAll, run } = require('../../db/query');
const { restoreBackup, readBackup } = require('../../db/restore');

function buildBackup(data) {
  const checksum = crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
  const counts = Object.fromEntries(
    Object.entries(data).map(([key, rows]) => [key, rows.length])
  );
  return { format: 'kasir-mini-backup', schema_version: 9, counts, checksum_sha256: checksum, ...data };
}

test('restore backup v9 memulihkan ledger dan setting stok minimum', async () => {
  await initDb();

  await run(`
    INSERT INTO master_barang
      (id, nama, nama_normalized, harga_retail, aktif, created_at, updated_at, stok)
    VALUES (1, 'Telur', 'telur', 28000, 1, '2026-08-01 08:00:00', '2026-08-01 08:00:00', 7)
  `);
  await run(`
    INSERT INTO stok_mutation
      (id, barang_id, tipe, perubahan, stok_sebelum, stok_sesudah, referensi_id, catatan, tanggal)
    VALUES (1, 1, 'opname', 7, 0, 7, NULL, 'Opname awal', '2026-08-01 08:00:00')
  `);

  const backup = buildBackup({
    pemasukan: [],
    pengeluaran: [],
    kasbon: [],
    kasbon_bayar: [],
    setting: [{ key: 'stok_minimum', value: '5' }],
    master_barang: [
      {
        id: 1, nama: 'Telur', nama_normalized: 'telur', harga_retail: 28000,
        harga_grosir: null, stok: 7, aktif: 1,
        created_at: '2026-08-01 08:00:00', updated_at: '2026-08-01 08:00:00',
        archived_at: null
      }
    ],
    penjualan: [],
    master_salesman: [],
    kulakan: [],
    kulakan_item: [],
    stok_adjustment: [],
    stok_mutation: [
      {
        id: 1, barang_id: 1, tipe: 'opname', perubahan: 7, stok_sebelum: 0,
        stok_sesudah: 7, referensi_id: null, catatan: 'Opname awal',
        tanggal: '2026-08-01 08:00:00'
      }
    ]
  });

  // Tulis ke file temp lalu restore.
  fs.writeFileSync(path.join(tmpDir, 'v9.json'), JSON.stringify(backup));
  await restoreBackup(readBackup(path.join(tmpDir, 'v9.json')));

  const restored = await getOne(
    'SELECT tipe, perubahan, stok_sebelum, stok_sesudah FROM stok_mutation WHERE barang_id = 1'
  );
  assert.deepEqual(restored, { tipe: 'opname', perubahan: 7, stok_sebelum: 0, stok_sesudah: 7 });

  const setting = await getOne("SELECT value FROM setting WHERE key = 'stok_minimum'");
  assert.equal(setting.value, '5');

  const barang = await getOne('SELECT stok FROM master_barang WHERE id = 1');
  assert.equal(barang.stok, 7);
});

test('restore backup v8 tanpa ledger tetap berhasil dan ledger kosong', async () => {
  await initDb();

  const v8data = {
    pemasukan: [],
    pengeluaran: [],
    kasbon: [],
    kasbon_bayar: [],
    setting: [],
    master_barang: [],
    penjualan: [],
    master_salesman: [],
    kulakan: [],
    kulakan_item: [],
    stok_adjustment: []
  };
  const checksum = crypto.createHash('sha256').update(JSON.stringify(v8data)).digest('hex');
  const v8backup = {
    format: 'kasir-mini-backup',
    schema_version: 8,
    counts: Object.fromEntries(Object.entries(v8data).map(([k, rows]) => [k, rows.length])),
    checksum_sha256: checksum,
    ...v8data
  };

  fs.writeFileSync(path.join(tmpDir, 'v8.json'), JSON.stringify(v8backup));
  await restoreBackup(readBackup(path.join(tmpDir, 'v8.json')));

  const mutations = await getAll('SELECT * FROM stok_mutation');
  assert.equal(mutations.length, 0);

  const setting = await getOne("SELECT value FROM setting WHERE key = 'stok_minimum'");
  assert.equal(setting.value, '5');
});
