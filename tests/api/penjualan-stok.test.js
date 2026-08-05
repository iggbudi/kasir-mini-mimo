const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kasir-stok-penjualan-'));
process.env.TURSO_DATABASE_URL = 'file:' + path.join(tmpDir, 'test.db');
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'admin123';

const { initDb } = require('../../db/init');
const app = require('../../server');

let server;
let baseUrl;
let cookie;
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

test('setup: login + barang dengan stok 10', async () => {
  cookie = await login();
  assert.ok(cookie);

  const created = await json('/api/barang', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({ nama: 'Gula', harga_retail: 17000 })
  });
  barangId = created.body.data.id;

  const opname = await json(`/api/barang/${barangId}/stok`, {
    method: 'PUT',
    headers: { cookie },
    body: JSON.stringify({ stok: 10 })
  });
  assert.equal(opname.res.status, 200);
  assert.equal(opname.body.data.stok_sesudah, 10);
});

test('penjualan mengurangi stok sesuai quantity', async () => {
  const sale = await json('/api/penjualan', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({
      jenis_harga: 'retail',
      items: [{ barang_id: barangId, quantity: 3, harga: 17000 }]
    })
  });
  assert.equal(sale.res.status, 201);
  assert.equal(await stokBarang(), 7);
});

test('penjualan melebihi stok tetap diperbolehkan, stok jadi minus', async () => {
  const sale = await json('/api/penjualan', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({
      jenis_harga: 'retail',
      items: [{ barang_id: barangId, quantity: 10, harga: 17000 }]
    })
  });
  assert.equal(sale.res.status, 201);
  assert.equal(await stokBarang(), -3);

  // Kembalikan stok ke 7 dengan opname supaya test berikutnya tidak terpengaruh.
  await json(`/api/barang/${barangId}/stok`, {
    method: 'PUT',
    headers: { cookie },
    body: JSON.stringify({ stok: 7 })
  });
  assert.equal(await stokBarang(), 7);
});

test('void penjualan mengembalikan stok', async () => {
  const sale = await json('/api/penjualan', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({
      jenis_harga: 'retail',
      items: [{ barang_id: barangId, quantity: 2, harga: 17000 }]
    })
  });
  assert.equal(sale.res.status, 201);
  assert.equal(await stokBarang(), 5);

  const del = await json(`/api/penjualan/${sale.body.data.id}`, {
    method: 'DELETE',
    headers: { cookie },
    body: JSON.stringify({ reason: 'Test' })
  });
  assert.equal(del.res.status, 200);
  assert.equal(del.body.data.stok_dikembalikan, 1);
  assert.equal(await stokBarang(), 7);
});

test('void dua kali tidak mengembalikan stok dua kali', async () => {
  const sale = await json('/api/penjualan', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({
      jenis_harga: 'retail',
      items: [{ barang_id: barangId, quantity: 1, harga: 17000 }]
    })
  });
  assert.equal(sale.res.status, 201);
  assert.equal(await stokBarang(), 6);

  const del1 = await json(`/api/penjualan/${sale.body.data.id}`, {
    method: 'DELETE',
    headers: { cookie },
    body: JSON.stringify({ reason: 'Test' })
  });
  assert.equal(del1.body.data.already_voided, false);
  assert.equal(await stokBarang(), 7);

  const del2 = await json(`/api/penjualan/${sale.body.data.id}`, {
    method: 'DELETE',
    headers: { cookie },
    body: JSON.stringify({ reason: 'Test' })
  });
  assert.equal(del2.body.data.already_voided, true);
  assert.equal(await stokBarang(), 7);
});

test('idempotency replay tidak mengurangi stok dua kali', async () => {
  const payload = {
    jenis_harga: 'retail',
    items: [{ barang_id: barangId, quantity: 2, harga: 17000 }]
  };
  const first = await json('/api/penjualan', {
    method: 'POST',
    headers: { cookie, 'Idempotency-Key': 'stok-penjualan-key' },
    body: JSON.stringify(payload)
  });
  assert.equal(first.res.status, 201);
  assert.equal(await stokBarang(), 5);

  const second = await json('/api/penjualan', {
    method: 'POST',
    headers: { cookie, 'Idempotency-Key': 'stok-penjualan-key' },
    body: JSON.stringify(payload)
  });
  assert.equal(second.res.status, 201);
  assert.equal(second.body.data.id, first.body.data.id);
  assert.equal(await stokBarang(), 5);
});
