const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kasir-pemasukan-'));
process.env.TURSO_DATABASE_URL = 'file:' + path.join(tmpDir, 'test.db');
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'admin123';

const { initDb } = require('../../db/init');
const app = require('../../server');

let server;
let baseUrl;

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

test('POST pemasukan tanpa barang ditolak', async () => {
  const cookie = await login();
  const { res, body } = await json('/api/pemasukan', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({ quantity: 2, harga: 15000 })
  });
  assert.equal(res.status, 400);
  assert.match(body.message, /wajib/i);
});

test('POST pemasukan harga negatif ditolak', async () => {
  const cookie = await login();
  const { res } = await json('/api/pemasukan', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({ barang: 'Test', quantity: 1, harga: -1 })
  });
  assert.equal(res.status, 400);
});

test('POST pemasukan sukses', async () => {
  const cookie = await login();
  const { res, body } = await json('/api/pemasukan', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({ barang: 'Beras', quantity: 2, harga: 15000, catatan: 'Test' })
  });
  assert.equal(res.status, 200);
  assert.equal(body.data.barang, 'Beras');
  assert.equal(body.data.total, 30000);
});

test('GET pemasukan tanpa query mengembalikan data hari ini', async () => {
  const cookie = await login();
  const { res, body } = await json('/api/pemasukan', { headers: { cookie } });
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(body.data));
});

test('DELETE pemasukan id tidak ada = 404', async () => {
  const cookie = await login();
  const { res, body } = await json('/api/pemasukan/99999', {
    method: 'DELETE',
    headers: { cookie }
  });
  assert.equal(res.status, 404);
});
