const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kasir-stock-config-'));
process.env.TURSO_DATABASE_URL = 'file:' + path.join(tmpDir, 'test.db');
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'admin123';

const { initDb } = require('../../db/init');
const { run } = require('../../db/query');
const app = require('../../server');

let server;
let baseUrl;
let cookie;
let barang;

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
  const result = await json('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  return result.res.headers.get('set-cookie');
}

async function create(name) {
  const result = await json('/api/barang', {
    method: 'POST', headers: { cookie },
    body: JSON.stringify({ nama: name, harga_retail: 1000 })
  });
  assert.equal(result.res.status, 201);
  return result.body.data;
}

test.before(async () => {
  await initDb();
  server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  cookie = await login();
  barang = await Promise.all(['Minus', 'Habis', 'Menipis', 'Batas', 'Aman'].map(create));
  for (const [item, stok] of barang.map((item, index) => [item, [-1, 0, 1, 5, 6][index]])) {
    await run('UPDATE master_barang SET stok = ? WHERE id = ?', [stok, item.id]);
  }
});

test.after(async () => new Promise(resolve => server.close(resolve)));

test('GET config default 5 dan klasifikasi semua kondisi', async () => {
  const config = await json('/api/barang/stok-config', { headers: { cookie } });
  assert.equal(config.res.status, 200);
  assert.equal(config.body.data.stok_minimum, 5);

  const all = await json('/api/barang?status=semua', { headers: { cookie } });
  assert.deepEqual(Object.fromEntries(all.body.data.map(row => [row.nama, row.kondisi_stok])), {
    Minus: 'minus', Habis: 'habis', Menipis: 'menipis', Batas: 'menipis', Aman: 'aman'
  });
});

test('filter kondisi dapat digabung q dan status', async () => {
  const thin = await json('/api/barang?kondisi_stok=menipis', { headers: { cookie } });
  assert.deepEqual(thin.body.data.map(row => row.stok).sort((a, b) => a - b), [1, 5]);
  assert.ok(thin.body.data.every(row => row.kondisi_stok === 'menipis'));

  await json(`/api/barang/${barang[4].id}`, { method: 'DELETE', headers: { cookie } });
  const combined = await json('/api/barang?q=aman&status=arsip&kondisi_stok=aman', { headers: { cookie } });
  assert.deepEqual(combined.body.data.map(row => row.nama), ['Aman']);
});

test('filter kondisi tidak dikenal ditolak', async () => {
  const result = await json('/api/barang?kondisi_stok=aneh', { headers: { cookie } });
  assert.equal(result.res.status, 400);
});

test('PUT config menerima integer dan mereklasifikasi stok', async () => {
  const put = await json('/api/barang/stok-config', {
    method: 'PUT', headers: { cookie }, body: JSON.stringify({ stok_minimum: 2 })
  });
  assert.equal(put.res.status, 200);
  assert.equal(put.body.data.stok_minimum, 2);
  const aman = await json('/api/barang?kondisi_stok=aman&status=semua', { headers: { cookie } });
  assert.ok(aman.body.data.some(row => row.nama === 'Batas' && row.stok === 5 && row.kondisi_stok === 'aman'));
});

test('PUT config menolak nilai tidak valid', async () => {
  for (const value of [0, -1, 1.5, 'abc', '']) {
    const result = await json('/api/barang/stok-config', {
      method: 'PUT', headers: { cookie }, body: JSON.stringify({ stok_minimum: value })
    });
    assert.equal(result.res.status, 400, `value=${value}`);
  }
});
