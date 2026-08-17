const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kasir-stok-config-'));
process.env.TURSO_DATABASE_URL = 'file:' + path.join(tmpDir, 'test.db');
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'admin123';

const { initDb } = require('../../db/init');
const { run } = require('../../db/query');
const app = require('../../server');

let server;
let baseUrl;
let cookie;

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

test('setup: login + lima barang dengan stok -1, 0, 1, 5, 6', async () => {
  cookie = await login();
  assert.ok(cookie);

  const names = ['Minus', 'Habis', 'Satu', 'Batas', 'Aman'];
  for (let i = 0; i < names.length; i += 1) {
    const created = await json('/api/barang', {
      method: 'POST',
      headers: { cookie },
      body: JSON.stringify({ nama: names[i], harga_retail: 10000 + i })
    });
    const id = created.body.data.id;
    const stokValues = [-1, 0, 1, 5, 6];
    await run('UPDATE master_barang SET stok = ? WHERE id = ?', [stokValues[i], id]);
  }
});

test('GET stok-config mengembalikan default 5', async () => {
  const config = await json('/api/barang/stok-config', { headers: { cookie } });
  assert.equal(config.res.status, 200);
  assert.equal(config.body.data.stok_minimum, 5);
});

test('filter kondisi stok bekerja untuk semua kategori', async () => {
  const minus = await json('/api/barang?kondisi_stok=minus', { headers: { cookie } });
  assert.deepEqual(minus.body.data.map(row => row.stok), [-1]);
  assert.ok(minus.body.data.every(row => row.kondisi_stok === 'minus'));

  const habis = await json('/api/barang?kondisi_stok=habis', { headers: { cookie } });
  assert.deepEqual(habis.body.data.map(row => row.stok), [0]);
  assert.ok(habis.body.data.every(row => row.kondisi_stok === 'habis'));

  const menipis = await json('/api/barang?kondisi_stok=menipis', { headers: { cookie } });
  assert.deepEqual(menipis.body.data.map(row => row.stok).sort((a, b) => a - b), [1, 5]);
  assert.ok(menipis.body.data.every(row => row.kondisi_stok === 'menipis'));

  const aman = await json('/api/barang?kondisi_stok=aman', { headers: { cookie } });
  assert.deepEqual(aman.body.data.map(row => row.stok), [6]);
  assert.ok(aman.body.data.every(row => row.kondisi_stok === 'aman'));
});

test('daftar barang tanpa filter tetap menyertakan kondisi_stok', async () => {
  const all = await json('/api/barang?status=semua', { headers: { cookie } });
  assert.equal(all.body.data.length, 5);
  assert.ok(all.body.data.every(row => ['minus', 'habis', 'menipis', 'aman'].includes(row.kondisi_stok)));
});

test('filter kondisi dapat digabung dengan q dan status', async () => {
  const combined = await json('/api/barang?status=aktif&q=ba&kondisi_stok=menipis', { headers: { cookie } });
  assert.ok(combined.body.data.every(row => row.kondisi_stok === 'menipis'));
  assert.ok(combined.body.data.length >= 1);
});

test('kondisi_stok tidak dikenal → 400', async () => {
  const { res } = await json('/api/barang?kondisi_stok=aneh', { headers: { cookie } });
  assert.equal(res.status, 400);
});

test('PUT stok-config valid mengubah batas dan mereklasifikasi stok', async () => {
  const put = await json('/api/barang/stok-config', {
    method: 'PUT',
    headers: { cookie },
    body: JSON.stringify({ stok_minimum: 2 })
  });
  assert.equal(put.res.status, 200);
  assert.equal(put.body.data.stok_minimum, 2);

  // Stok 5 sekarang > batas 2 → aman; stok 1 tetap menipis.
  const aman = await json('/api/barang?kondisi_stok=aman', { headers: { cookie } });
  assert.deepEqual(aman.body.data.map(row => row.stok).sort((a, b) => a - b), [5, 6]);
  const menipis = await json('/api/barang?kondisi_stok=menipis', { headers: { cookie } });
  assert.deepEqual(menipis.body.data.map(row => row.stok), [1]);
});

test('PUT stok-config menolak nilai tidak valid', async () => {
  for (const value of [0, -1, 1.5, 'abc', '']) {
    const { res } = await json('/api/barang/stok-config', {
      method: 'PUT',
      headers: { cookie },
      body: JSON.stringify({ stok_minimum: value })
    });
    assert.equal(res.status, 400, `nilai ${JSON.stringify(value)} harus ditolak`);
  }
});
