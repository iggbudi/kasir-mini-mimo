const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kasir-opname-'));
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

test('setup: login + barang', async () => {
  cookie = await login();
  assert.ok(cookie);
  const created = await json('/api/barang', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({ nama: 'Telur', harga_retail: 28000 })
  });
  barangId = created.body.data.id;
});

test('PUT stok tanpa login ditolak', async () => {
  const { res } = await json(`/api/barang/${barangId}/stok`, {
    method: 'PUT',
    body: JSON.stringify({ stok: 5 })
  });
  assert.equal(res.status, 401);
});

test('PUT stok valid → 200, stok tersimpan, ada riwayat', async () => {
  const put = await json(`/api/barang/${barangId}/stok`, {
    method: 'PUT',
    headers: { cookie },
    body: JSON.stringify({ stok: 15, catatan: 'Opname awal' })
  });
  assert.equal(put.res.status, 200);
  assert.equal(put.body.data.stok_sebelum, 0);
  assert.equal(put.body.data.stok_sesudah, 15);

  const { body } = await json('/api/barang', { headers: { cookie } });
  assert.equal(body.data.find(item => item.id === barangId).stok, 15);

  // Riwayat opname terlihat di backup.
  const backup = await json('/api/backup', { headers: { cookie } });
  const riwayat = backup.body.stok_adjustment.filter(row => row.barang_id === barangId);
  assert.equal(riwayat.length, 1);
  assert.equal(riwayat[0].stok_sebelum, 0);
  assert.equal(riwayat[0].stok_sesudah, 15);
});

test('PUT stok negatif ditolak', async () => {
  const { res } = await json(`/api/barang/${barangId}/stok`, {
    method: 'PUT',
    headers: { cookie },
    body: JSON.stringify({ stok: -1 })
  });
  assert.equal(res.status, 400);
});

test('PUT stok bukan bilangan bulat ditolak', async () => {
  const { res } = await json(`/api/barang/${barangId}/stok`, {
    method: 'PUT',
    headers: { cookie },
    body: JSON.stringify({ stok: 'abc' })
  });
  assert.equal(res.status, 400);
});

test('PUT stok barang tidak ada → 404', async () => {
  const { res } = await json('/api/barang/99999/stok', {
    method: 'PUT',
    headers: { cookie },
    body: JSON.stringify({ stok: 5 })
  });
  assert.equal(res.status, 404);
});
