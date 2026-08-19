const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kasir-pagination-'));
process.env.TURSO_DATABASE_URL = 'file:' + path.join(tmpDir, 'test.db');
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'admin123';
process.env.SESSION_HOURS = '12';

const { initDb } = require('../../db/init');
const app = require('../../server');

let server;
let baseUrl;
let cookie;

function getCookie(res) {
  const raw = res.headers.get('set-cookie') || '';
  const match = raw.match(/sid=[^;]+/);
  return match ? match[0] : '';
}

async function json(pathname, options = {}) {
  const res = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const body = await res.json().catch(() => null);
  return { res, body };
}

test.before(async () => {
  await initDb();
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
  const { res } = await json('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  cookie = getCookie(res);
  assert.ok(cookie, 'login harus dapat cookie');

  // Seed 2 barang + 1 salesman
  await json('/api/barang', { method: 'POST', headers: { cookie }, body: JSON.stringify({ nama: 'Barang Penjual', harga_retail: 10000 }) });
  await json('/api/salesman', { method: 'POST', headers: { cookie }, body: JSON.stringify({ nama: 'Sales Pagination' }) });
  const barangList = await json('/api/barang', { headers: { cookie } });
  const barangId = barangList.body.data[0].id;
  const salesmanList = await json('/api/salesman', { headers: { cookie } });
  const salesmanId = salesmanList.body.data[0].id;

  // Buat 3 penjualan + 2 kulakan untuk pagination
  for (let i = 0; i < 3; i++) {
    await json('/api/penjualan', {
      method: 'POST',
      headers: { cookie, 'Idempotency-Key': `pag-penjualan-${i}-12345678` },
      body: JSON.stringify({ jenis_harga: 'retail', items: [{ barang_id: barangId, quantity: 1, harga: 10000 }] })
    });
  }
  for (let i = 0; i < 2; i++) {
    await json('/api/kulakan', {
      method: 'POST',
      headers: { cookie, 'Idempotency-Key': `pag-kulakan-${i}-12345678` },
      body: JSON.stringify({ salesman_id: salesmanId, items: [{ barang_id: barangId, quantity: 1, harga_beli: 8000 }] })
    });
  }
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('GET /api/penjualan tanpa pagination tetap array (backward compat)', async () => {
  const { res, body } = await json('/api/penjualan', { headers: { cookie } });
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(body.data), 'tanpa limit harus array');
});

test('GET /api/penjualan?limit=1&offset=0 mengembalikan wrapper pagination', async () => {
  const { res, body } = await json('/api/penjualan?limit=1&offset=0', { headers: { cookie } });
  assert.equal(res.status, 200);
  assert.ok(body.data.items, 'harus ada items');
  assert.equal(body.data.items.length, 1);
  assert.equal(typeof body.data.pagination.has_more, 'boolean');
  assert.equal(body.data.pagination.limit, 1);
  assert.equal(body.data.pagination.offset, 0);
});

test('GET /api/penjualan?limit=1&offset=1 has_more true bila masih ada data', async () => {
  const { res, body } = await json('/api/penjualan?limit=1&offset=1', { headers: { cookie } });
  assert.equal(res.status, 200);
  assert.equal(body.data.items.length, 1);
  assert.equal(body.data.pagination.has_more, true);
});

test('GET /api/penjualan?limit=999 ditolak 400', async () => {
  const { res } = await json('/api/penjualan?limit=999', { headers: { cookie } });
  assert.equal(res.status, 400);
});

test('GET /api/kulakan?limit=1&offset=0 pagination', async () => {
  const { res, body } = await json('/api/kulakan?limit=1&offset=0', { headers: { cookie } });
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(body.data.items));
  assert.equal(body.data.pagination.limit, 1);
});

test('GET /api/kulakan tanpa pagination tetap array', async () => {
  const { res, body } = await json('/api/kulakan', { headers: { cookie } });
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(body.data));
});

test('GET /api/riwayat?limit=2&offset=0 pagination', async () => {
  const { res, body } = await json('/api/riwayat?limit=2&offset=0', { headers: { cookie } });
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(body.data.items));
  assert.equal(typeof body.data.pagination.has_more, 'boolean');
});

test('GET /api/riwayat tanpa pagination tetap {items}', async () => {
  const { res, body } = await json('/api/riwayat', { headers: { cookie } });
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(body.data.items));
  assert.equal(body.data.pagination, undefined);
});
