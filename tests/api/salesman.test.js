const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kasir-salesman-'));
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

async function createSalesman(cookie, nama) {
  const { res, body } = await json('/api/salesman', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({ nama })
  });
  assert.equal(res.status, 201);
  return body.data;
}

test('POST salesman tanpa login ditolak', async () => {
  const { res } = await json('/api/salesman', {
    method: 'POST',
    body: JSON.stringify({ nama: 'X' })
  });
  assert.equal(res.status, 401);
});

test('POST salesman valid → 201', async () => {
  const cookie = await login();
  const created = await createSalesman(cookie, 'Budi Santoso');
  assert.ok(created.id > 0);
  assert.equal(created.nama, 'Budi Santoso');
  assert.equal(created.aktif, 1);
});

test('POST salesman tanpa nama ditolak', async () => {
  const cookie = await login();
  const { res, body } = await json('/api/salesman', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({})
  });
  assert.equal(res.status, 400);
  assert.match(body.message, /nama/i);
});

test('POST nama salesman duplikat tidak peka kapital → 409', async () => {
  const cookie = await login();
  await createSalesman(cookie, 'Andi Wijaya');
  const { res, body } = await json('/api/salesman', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({ nama: '  andi   wijaya ' })
  });
  assert.equal(res.status, 409);
  assert.match(body.message, /sudah terdaftar/);
});

test('PUT salesman valid → 200', async () => {
  const cookie = await login();
  const created = await createSalesman(cookie, 'Citra');
  const { res, body } = await json(`/api/salesman/${created.id}`, {
    method: 'PUT',
    headers: { cookie },
    body: JSON.stringify({ nama: 'Citra Dewi' })
  });
  assert.equal(res.status, 200);
  assert.equal(body.data.nama, 'Citra Dewi');
});

test('PUT salesman id tidak ada → 404', async () => {
  const cookie = await login();
  const { res } = await json('/api/salesman/99999', {
    method: 'PUT',
    headers: { cookie },
    body: JSON.stringify({ nama: 'X' })
  });
  assert.equal(res.status, 404);
});

test('DELETE arsipkan lalu aktifkan kembali', async () => {
  const cookie = await login();
  const created = await createSalesman(cookie, 'Dedi');

  const arsip = await json(`/api/salesman/${created.id}`, { method: 'DELETE', headers: { cookie } });
  assert.equal(arsip.body.data.archived, true);

  const listAktif = await json('/api/salesman', { headers: { cookie } });
  assert.ok(!listAktif.body.data.some(item => item.id === created.id));

  const aktif = await json(`/api/salesman/${created.id}/aktifkan`, { method: 'POST', headers: { cookie } });
  assert.equal(aktif.body.data.active, true);

  const listSemua = await json('/api/salesman?status=semua', { headers: { cookie } });
  assert.equal(listSemua.body.data.find(item => item.id === created.id).aktif, 1);
});

test('GET salesman status invalid → 400', async () => {
  const cookie = await login();
  const { res } = await json('/api/salesman?status=aneh', { headers: { cookie } });
  assert.equal(res.status, 400);
});

test('GET salesman q= mencari potongan nama', async () => {
  const cookie = await login();
  await createSalesman(cookie, 'Rudi Hermawan');
  await createSalesman(cookie, 'Rudi Pratama');
  await createSalesman(cookie, 'Sari');

  const { body } = await json('/api/salesman?q=rud', { headers: { cookie } });
  const names = body.data.map(item => item.nama);
  assert.ok(names.includes('Rudi Hermawan'));
  assert.ok(names.includes('Rudi Pratama'));
  assert.ok(!names.includes('Sari'));
});
