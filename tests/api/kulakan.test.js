const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kasir-kulakan-'));
process.env.TURSO_DATABASE_URL = 'file:' + path.join(tmpDir, 'test.db');
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'admin123';

const { initDb } = require('../../db/init');
const app = require('../../server');

let server;
let baseUrl;
let cookie;
let salesmanId;
let barangIds = [];

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

test('setup: login + master salesman + master barang', async () => {
  cookie = await login();
  assert.ok(cookie);

  const salesman = await json('/api/salesman', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({ nama: 'Salesman Tetap' })
  });
  salesmanId = salesman.body.data.id;

  for (const nama of ['Beras 5kg', 'Minyak 1L']) {
    const barang = await json('/api/barang', {
      method: 'POST',
      headers: { cookie },
      body: JSON.stringify({ nama, harga_retail: 10000 })
    });
    barangIds.push(barang.body.data.id);
  }
  assert.equal(barangIds.length, 2);
});

test('POST kulakan tanpa login ditolak', async () => {
  const { res } = await json('/api/kulakan', {
    method: 'POST',
    body: JSON.stringify({ salesman_id: 1, items: [{ barang_id: 1, quantity: 1, harga_beli: 1000 }] })
  });
  assert.equal(res.status, 401);
});

test('POST kulakan valid → 201, nomor & snapshot benar', async () => {
  const { res, body } = await json('/api/kulakan', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({
      salesman_id: salesmanId,
      items: [
        { barang_id: barangIds[0], quantity: 2, harga_beli: 62000 },
        { barang_id: barangIds[1], quantity: 3, harga_beli: 17500 }
      ]
    })
  });
  assert.equal(res.status, 201);
  assert.match(body.data.nomor_kulakan, /^KL-\d{8}-\d{6}$/);
  assert.equal(body.data.salesman_nama, 'Salesman Tetap');
  assert.equal(body.data.total, 2 * 62000 + 3 * 17500);
  assert.equal(body.data.items.length, 2);
  assert.equal(body.data.items[0].barang_nama, 'Beras 5kg');
});

test('POST kulakan salesman tidak ditemukan → 400', async () => {
  const { res } = await json('/api/kulakan', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({ salesman_id: 99999, items: [{ barang_id: barangIds[0], quantity: 1, harga_beli: 1000 }] })
  });
  assert.equal(res.status, 400);
});

test('POST kulakan barang tidak ditemukan/diarsipkan → 400', async () => {
  const { res } = await json('/api/kulakan', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({ salesman_id: salesmanId, items: [{ barang_id: 99999, quantity: 1, harga_beli: 1000 }] })
  });
  assert.equal(res.status, 400);
});

test('POST kulakan items kosong ditolak', async () => {
  const { res } = await json('/api/kulakan', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({ salesman_id: salesmanId, items: [] })
  });
  assert.equal(res.status, 400);
});

test('POST kulakan quantity 0 ditolak', async () => {
  const { res } = await json('/api/kulakan', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({ salesman_id: salesmanId, items: [{ barang_id: barangIds[0], quantity: 0, harga_beli: 1000 }] })
  });
  assert.equal(res.status, 400);
});

test('GET kulakan list hari ini memuat transaksi baru', async () => {
  const { res, body } = await json('/api/kulakan', { headers: { cookie } });
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(body.data));
  assert.ok(body.data.some(item => item.total === 2 * 62000 + 3 * 17500));
});

test('GET kulakan detail sesuai header', async () => {
  const list = await json('/api/kulakan', { headers: { cookie } });
  const id = list.body.data[0].id;

  const { res, body } = await json(`/api/kulakan/${id}`, { headers: { cookie } });
  assert.equal(res.status, 200);
  assert.equal(body.data.id, id);
  assert.equal(body.data.items.length, 2);
});

test('GET kulakan id tidak ada → 404', async () => {
  const { res } = await json('/api/kulakan/99999', { headers: { cookie } });
  assert.equal(res.status, 404);
});

test('Idempotency-Key sama + payload sama → replay tanpa duplikat', async () => {
  const payload = {
    salesman_id: salesmanId,
    items: [{ barang_id: barangIds[0], quantity: 5, harga_beli: 61000 }]
  };
  const first = await json('/api/kulakan', {
    method: 'POST',
    headers: { cookie, 'Idempotency-Key': 'kulakan-test-001' },
    body: JSON.stringify(payload)
  });
  assert.equal(first.res.status, 201);

  const second = await json('/api/kulakan', {
    method: 'POST',
    headers: { cookie, 'Idempotency-Key': 'kulakan-test-001' },
    body: JSON.stringify(payload)
  });
  assert.equal(second.res.status, 201);
  assert.equal(second.body.data.id, first.body.data.id);
});

test('Idempotency-Key sama + payload beda → 409', async () => {
  const payloadA = { salesman_id: salesmanId, items: [{ barang_id: barangIds[1], quantity: 1, harga_beli: 17000 }] };
  const payloadB = { salesman_id: salesmanId, items: [{ barang_id: barangIds[1], quantity: 2, harga_beli: 17000 }] };

  const first = await json('/api/kulakan', {
    method: 'POST',
    headers: { cookie, 'Idempotency-Key': 'kulakan-conflict' },
    body: JSON.stringify(payloadA)
  });
  assert.equal(first.res.status, 201);

  const second = await json('/api/kulakan', {
    method: 'POST',
    headers: { cookie, 'Idempotency-Key': 'kulakan-conflict' },
    body: JSON.stringify(payloadB)
  });
  assert.equal(second.res.status, 409);
});

test('DELETE kulakan membatalkan dampak kas', async () => {
  const created = await json('/api/kulakan', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({
      salesman_id: salesmanId,
      items: [{ barang_id: barangIds[0], quantity: 10, harga_beli: 60000 }]
    })
  });
  const id = created.body.data.id;

  const before = await json('/api/ringkasan', { headers: { cookie } });
  const beforeKulakan = before.body.data.kulakan;

  const del = await json(`/api/kulakan/${id}`, {
    method: 'DELETE',
    headers: { cookie },
    body: JSON.stringify({ reason: 'Salah input' })
  });
  assert.equal(del.res.status, 200);
  assert.equal(del.body.data.voided, true);

  const after = await json('/api/ringkasan', { headers: { cookie } });
  assert.equal(beforeKulakan - after.body.data.kulakan, 600000);
});

test('DELETE kulakan id tidak ada → 404', async () => {
  const { res } = await json('/api/kulakan/99999', {
    method: 'DELETE',
    headers: { cookie },
    body: JSON.stringify({ reason: 'X' })
  });
  assert.equal(res.status, 404);
});
