const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kasir-stok-kulakan-'));
process.env.TURSO_DATABASE_URL = 'file:' + path.join(tmpDir, 'test.db');
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'admin123';

const { initDb } = require('../../db/init');
const { getAll } = require('../../db/query');
const app = require('../../server');

let server;
let baseUrl;
let cookie;
let salesmanId;
let barangId;

test.before(async () => {
  await initDb();
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

async function json(pathname, options = {}) {
  const { headers: optHeaders = {}, ...rest } = options;
  const res = await fetch(`${baseUrl}${pathname}`, {
    headers: { 'Content-Type': 'application/json', ...optHeaders },
    ...rest
  });
  let body = null;
  try { body = await res.json(); } catch (_) {}
  return { res, body };
}

async function login() {
  const loginRes = await json('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  return loginRes.res.headers.get('set-cookie');
}

async function stokBarang() {
  const { body } = await json('/api/barang', { headers: { cookie } });
  return body.data.find(item => item.id === barangId).stok;
}

test('setup: login + salesman + barang (stok 0)', async () => {
  cookie = await login();
  assert.ok(cookie);

  const salesman = await json('/api/salesman', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({ nama: 'Salesman Stok' })
  });
  salesmanId = salesman.body.data.id;

  const created = await json('/api/barang', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({ nama: 'Beras', harga_retail: 65000 })
  });
  barangId = created.body.data.id;
  assert.equal(await stokBarang(), 0);
});

test('kulakan mengagregasikan detail duplikat dan idempotensi tidak menggandakan ledger', async () => {
  const payload = {
    salesman_id: salesmanId,
    items: [
      { barang_id: barangId, quantity: 2, harga_beli: 60000 },
      { barang_id: barangId, quantity: 3, harga_beli: 60000 }
    ]
  };
  const kulakan = await json('/api/kulakan', {
    method: 'POST',
    headers: { cookie, 'Idempotency-Key': 'kulakan-stok-001' },
    body: JSON.stringify(payload)
  });
  assert.equal(kulakan.res.status, 201);
  const replay = await json('/api/kulakan', {
    method: 'POST',
    headers: { cookie, 'Idempotency-Key': 'kulakan-stok-001' },
    body: JSON.stringify(payload)
  });
  assert.equal(replay.res.status, 201);
  assert.equal(replay.body.data.id, kulakan.body.data.id);
  assert.equal(await stokBarang(), 5);

  const rows = await getAll(
    "SELECT * FROM stok_mutation WHERE referensi_id = ? AND tipe = 'kulakan'",
    [kulakan.body.data.id]
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].perubahan, 5);
});

test('void kulakan mengurangi stok, mencatat alasan, riwayat, dan idempotensi', async () => {
  const list = await json('/api/kulakan', { headers: { cookie } });
  const purchase = list.body.data[0];
  const del = await json(`/api/kulakan/${purchase.id}`, {
    method: 'DELETE',
    headers: { cookie },
    body: JSON.stringify({ reason: 'Test' })
  });
  assert.equal(del.res.status, 200);
  assert.equal(del.body.data.voided, true);
  assert.equal(await stokBarang(), 0);

  const rows = await getAll(
    "SELECT * FROM stok_mutation WHERE referensi_id = ? AND tipe = 'batal_kulakan'",
    [purchase.id]
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].perubahan, -5);
  assert.equal(rows[0].catatan, 'Test');

  const history = await json(`/api/barang/${barangId}/mutasi`, { headers: { cookie } });
  const voidMutation = history.body.data.items.find(row => row.tipe === 'batal_kulakan');
  assert.equal(voidMutation.nomor_referensi, purchase.nomor_kulakan);

  const second = await json(`/api/kulakan/${purchase.id}`, {
    method: 'DELETE',
    headers: { cookie },
    body: JSON.stringify({ reason: 'Void kedua' })
  });
  assert.equal(second.res.status, 200);
  assert.equal(second.body.data.already_voided, true);
  const after = await getAll(
    "SELECT * FROM stok_mutation WHERE referensi_id = ? AND tipe = 'batal_kulakan'",
    [purchase.id]
  );
  assert.equal(after.length, 1);
});

test('kegagalan ledger kulakan rollback header dan stok', async () => {
  const { getOne, run } = require('../../db/query');
  const stokSebelum = await stokBarang();
  const headerSebelum = (await getOne('SELECT COUNT(*) AS jumlah FROM kulakan')).jumlah;
  await run(`CREATE TRIGGER fail_purchase_mutation BEFORE INSERT ON stok_mutation WHEN NEW.tipe = 'kulakan' BEGIN SELECT RAISE(ABORT, 'forced kulakan ledger failure'); END`);
  try {
    const result = await json('/api/kulakan', { method: 'POST', headers: { cookie }, body: JSON.stringify({ salesman_id: salesmanId, items: [{ barang_id: barangId, quantity: 1, harga_beli: 60000 }] }) });
    assert.equal(result.res.status, 500);
    assert.equal(await stokBarang(), stokSebelum);
    assert.equal((await getOne('SELECT COUNT(*) AS jumlah FROM kulakan')).jumlah, headerSebelum);
  } finally {
    await run('DROP TRIGGER IF EXISTS fail_purchase_mutation');
  }
});

test('kegagalan ledger pembatalan kulakan rollback void dan stok', async () => {
  const { getOne, run } = require('../../db/query');
  const purchase = (await json('/api/kulakan', { method: 'POST', headers: { cookie }, body: JSON.stringify({ salesman_id: salesmanId, items: [{ barang_id: barangId, quantity: 2, harga_beli: 60000 }] }) })).body.data;
  const stokSebelum = await stokBarang();
  await run(`CREATE TRIGGER fail_void_purchase_mutation BEFORE INSERT ON stok_mutation WHEN NEW.tipe = 'batal_kulakan' BEGIN SELECT RAISE(ABORT, 'forced void ledger failure'); END`);
  try {
    const result = await json(`/api/kulakan/${purchase.id}`, { method: 'DELETE', headers: { cookie }, body: JSON.stringify({ reason: 'gagal' }) });
    assert.equal(result.res.status, 500);
    assert.equal(await stokBarang(), stokSebelum);
    assert.equal((await getOne('SELECT voided_at FROM kulakan WHERE id = ?', [purchase.id])).voided_at, null);
  } finally {
    await run('DROP TRIGGER IF EXISTS fail_void_purchase_mutation');
  }
});

test('void kulakan setelah barang terjual → stok boleh minus', async () => {
  const stokAwal = await stokBarang();
  const kulakan = await json('/api/kulakan', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({
      salesman_id: salesmanId,
      items: [{ barang_id: barangId, quantity: 5, harga_beli: 60000 }]
    })
  });
  const kulakanId = kulakan.body.data.id;
  assert.equal(await stokBarang(), stokAwal + 5);

  const sale = await json('/api/penjualan', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({
      jenis_harga: 'retail',
      items: [{ barang_id: barangId, quantity: 3, harga: 65000 }]
    })
  });
  assert.equal(sale.res.status, 201);
  assert.equal(await stokBarang(), stokAwal + 2);

  const del = await json(`/api/kulakan/${kulakanId}`, {
    method: 'DELETE',
    headers: { cookie },
    body: JSON.stringify({ reason: 'Batal setelah terjual' })
  });
  assert.equal(del.res.status, 200);
  assert.equal(await stokBarang(), stokAwal - 3);
});
