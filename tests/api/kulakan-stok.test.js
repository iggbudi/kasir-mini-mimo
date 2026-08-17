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

test('kulakan menambah stok sesuai quantity', async () => {
  const kulakan = await json('/api/kulakan', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({
      salesman_id: salesmanId,
      items: [{ barang_id: barangId, quantity: 5, harga_beli: 60000 }]
    })
  });
  assert.equal(kulakan.res.status, 201);
  assert.equal(await stokBarang(), 5);
});

test('void kulakan mengurangi stok kembali', async () => {
  const list = await json('/api/kulakan', { headers: { cookie } });
  const id = list.body.data[0].id;

  const del = await json(`/api/kulakan/${id}`, {
    method: 'DELETE',
    headers: { cookie },
    body: JSON.stringify({ reason: 'Test' })
  });
  assert.equal(del.res.status, 200);
  assert.equal(del.body.data.voided, true);
  assert.equal(await stokBarang(), 0);
});

test('void kulakan setelah barang terjual → stok boleh minus', async () => {
  const kulakan = await json('/api/kulakan', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({
      salesman_id: salesmanId,
      items: [{ barang_id: barangId, quantity: 5, harga_beli: 60000 }]
    })
  });
  const kulakanId = kulakan.body.data.id;
  assert.equal(await stokBarang(), 5);

  const sale = await json('/api/penjualan', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({
      jenis_harga: 'retail',
      items: [{ barang_id: barangId, quantity: 3, harga: 65000 }]
    })
  });
  assert.equal(sale.res.status, 201);
  assert.equal(await stokBarang(), 2);

  const del = await json(`/api/kulakan/${kulakanId}`, {
    method: 'DELETE',
    headers: { cookie },
    body: JSON.stringify({ reason: 'Batal setelah terjual' })
  });
  assert.equal(del.res.status, 200);
  assert.equal(await stokBarang(), -3);
});

test('kulakan menulis satu mutasi agregat per barang', async () => {
  const kulakan = await json('/api/kulakan', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({
      salesman_id: salesmanId,
      items: [
        { barang_id: barangId, quantity: 2, harga_beli: 60000 },
        { barang_id: barangId, quantity: 3, harga_beli: 60000 }
      ]
    })
  });
  assert.equal(kulakan.res.status, 201);

  const rows = await getAll(
    "SELECT * FROM stok_mutation WHERE referensi_id = ? AND tipe = 'kulakan'",
    [kulakan.body.data.id]
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].perubahan, 5);
  assert.equal(rows[0].stok_sesudah, rows[0].stok_sebelum + 5);
});

test('void kulakan menulis batal_kulakan dengan alasan', async () => {
  const stokSebelum = await stokBarang();
  const kulakan = await json('/api/kulakan', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({
      salesman_id: salesmanId,
      items: [{ barang_id: barangId, quantity: 4, harga_beli: 60000 }]
    })
  });
  const kulakanId = kulakan.body.data.id;
  assert.equal(await stokBarang(), stokSebelum + 4);

  const del = await json(`/api/kulakan/${kulakanId}`, {
    method: 'DELETE',
    headers: { cookie },
    body: JSON.stringify({ reason: 'Salah kirim' })
  });
  assert.equal(del.res.status, 200);
  assert.equal(await stokBarang(), stokSebelum);

  const rows = await getAll(
    "SELECT * FROM stok_mutation WHERE referensi_id = ? AND tipe = 'batal_kulakan'",
    [kulakanId]
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].perubahan, -4);
  assert.equal(rows[0].stok_sebelum, stokSebelum + 4);
  assert.equal(rows[0].stok_sesudah, stokSebelum);
  assert.equal(rows[0].catatan, 'Salah kirim');

  // Endpoint riwayat menampilkan nomor kulakan.
  const history = await json(`/api/barang/${barangId}/mutasi?limit=10`, { headers: { cookie } });
  const batal = history.body.data.items.find(row => row.tipe === 'batal_kulakan');
  assert.equal(batal.nomor_referensi, kulakan.body.data.nomor_kulakan);
});

test('void kedua dan replay idempotensi tidak menambah ledger', async () => {
  const stokSebelum = await stokBarang();
  const kulakan = await json('/api/kulakan', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({
      salesman_id: salesmanId,
      items: [{ barang_id: barangId, quantity: 2, harga_beli: 60000 }]
    })
  });
  const kulakanId = kulakan.body.data.id;
  assert.equal(await stokBarang(), stokSebelum + 2);

  const del1 = await json(`/api/kulakan/${kulakanId}`, {
    method: 'DELETE',
    headers: { cookie },
    body: JSON.stringify({ reason: 'Test' })
  });
  assert.equal(del1.body.data.already_voided, false);
  assert.equal(await stokBarang(), stokSebelum);
  const afterFirst = await getAll(
    "SELECT * FROM stok_mutation WHERE referensi_id = ? AND tipe = 'batal_kulakan'",
    [kulakanId]
  );
  assert.equal(afterFirst.length, 1);

  const del2 = await json(`/api/kulakan/${kulakanId}`, {
    method: 'DELETE',
    headers: { cookie },
    body: JSON.stringify({ reason: 'Test' })
  });
  assert.equal(del2.body.data.already_voided, true);
  const afterSecond = await getAll(
    "SELECT * FROM stok_mutation WHERE referensi_id = ? AND tipe = 'batal_kulakan'",
    [kulakanId]
  );
  assert.equal(afterSecond.length, 1);

  // Replay idempotensi.
  const payload = {
    salesman_id: salesmanId,
    items: [{ barang_id: barangId, quantity: 1, harga_beli: 60000 }]
  };
  const first = await json('/api/kulakan', {
    method: 'POST',
    headers: { cookie, 'Idempotency-Key': 'stok-kulakan-key' },
    body: JSON.stringify(payload)
  });
  assert.equal(first.res.status, 201);
  const before = await getAll(
    "SELECT * FROM stok_mutation WHERE referensi_id = ? AND tipe = 'kulakan'",
    [first.body.data.id]
  );
  assert.equal(before.length, 1);

  const second = await json('/api/kulakan', {
    method: 'POST',
    headers: { cookie, 'Idempotency-Key': 'stok-kulakan-key' },
    body: JSON.stringify(payload)
  });
  assert.equal(second.res.status, 201);
  assert.equal(second.body.data.id, first.body.data.id);
  const after = await getAll(
    "SELECT * FROM stok_mutation WHERE referensi_id = ? AND tipe = 'kulakan'",
    [first.body.data.id]
  );
  assert.equal(after.length, 1);
});
