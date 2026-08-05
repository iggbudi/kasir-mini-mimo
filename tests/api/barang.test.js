const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kasir-barang-'));
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

async function createBarang(cookie, payload) {
  const { res, body } = await json('/api/barang', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify(payload)
  });
  assert.equal(res.status, 201);
  return body.data;
}

test('POST barang tanpa login ditolak', async () => {
  const { res } = await json('/api/barang', {
    method: 'POST',
    body: JSON.stringify({ nama: 'X', harga_retail: 1000 })
  });
  assert.equal(res.status, 401);
});

test('POST barang valid → 201', async () => {
  const cookie = await login();
  const created = await createBarang(cookie, { nama: 'Beras 5kg', harga_retail: 65000, harga_grosir: 62000 });
  assert.ok(created.id > 0);
  assert.equal(created.nama, 'Beras 5kg');
  assert.equal(created.aktif, 1);
});

test('POST barang tanpa nama ditolak', async () => {
  const cookie = await login();
  const { res, body } = await json('/api/barang', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({ harga_retail: 1000 })
  });
  assert.equal(res.status, 400);
  assert.match(body.message, /nama/i);
});

test('POST harga_grosir > harga_retail ditolak', async () => {
  const cookie = await login();
  const { res } = await json('/api/barang', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({ nama: 'Gula', harga_retail: 15000, harga_grosir: 20000 })
  });
  assert.equal(res.status, 400);
});

test('POST nama duplikat tidak peka kapital/spasi → 409', async () => {
  const cookie = await login();
  await createBarang(cookie, { nama: 'Minyak Goreng', harga_retail: 18000 });
  const { res, body } = await json('/api/barang', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({ nama: '  minyak   goreng ', harga_retail: 18000 })
  });
  assert.equal(res.status, 409);
  assert.match(body.message, /sudah terdaftar/);
});

test('PUT barang valid → 200 dan nama berubah', async () => {
  const cookie = await login();
  const created = await createBarang(cookie, { nama: 'Telur 1kg', harga_retail: 28000 });
  const { res, body } = await json(`/api/barang/${created.id}`, {
    method: 'PUT',
    headers: { cookie },
    body: JSON.stringify({ nama: 'Telur Ayam 1kg', harga_retail: 29000, harga_grosir: 28000 })
  });
  assert.equal(res.status, 200);
  assert.equal(body.data.nama, 'Telur Ayam 1kg');
  assert.equal(body.data.harga_retail, 29000);
});

test('PUT barang id tidak ada → 404', async () => {
  const cookie = await login();
  const { res } = await json('/api/barang/99999', {
    method: 'PUT',
    headers: { cookie },
    body: JSON.stringify({ nama: 'X', harga_retail: 1000 })
  });
  assert.equal(res.status, 404);
});

test('DELETE barang arsipkan, kedua kalinya already_archived', async () => {
  const cookie = await login();
  const created = await createBarang(cookie, { nama: 'Kopi Sachet', harga_retail: 2000 });
  const first = await json(`/api/barang/${created.id}`, { method: 'DELETE', headers: { cookie } });
  assert.equal(first.res.status, 200);
  assert.equal(first.body.data.archived, true);
  assert.equal(first.body.data.already_archived, false);

  const second = await json(`/api/barang/${created.id}`, { method: 'DELETE', headers: { cookie } });
  assert.equal(second.body.data.already_archived, true);
});

test('DELETE barang id tidak ada → 404', async () => {
  const cookie = await login();
  const { res } = await json('/api/barang/99999', { method: 'DELETE', headers: { cookie } });
  assert.equal(res.status, 404);
});

test('POST aktifkan mengembalikan barang ke daftar aktif', async () => {
  const cookie = await login();
  const created = await createBarang(cookie, { nama: 'Teh Celup', harga_retail: 5000 });
  await json(`/api/barang/${created.id}`, { method: 'DELETE', headers: { cookie } });

  const active = await json(`/api/barang/${created.id}/aktifkan`, { method: 'POST', headers: { cookie } });
  assert.equal(active.res.status, 200);
  assert.equal(active.body.data.active, true);

  const list = await json('/api/barang', { headers: { cookie } });
  assert.ok(list.body.data.some(item => item.id === created.id));
});

test('GET barang default hanya aktif; status=semua menyertakan arsip', async () => {
  const cookie = await login();
  const created = await createBarang(cookie, { nama: 'Susu UHT', harga_retail: 9000 });
  await json(`/api/barang/${created.id}`, { method: 'DELETE', headers: { cookie } });

  const aktif = await json('/api/barang', { headers: { cookie } });
  assert.ok(!aktif.body.data.some(item => item.id === created.id));

  const semua = await json('/api/barang?status=semua', { headers: { cookie } });
  assert.ok(semua.body.data.some(item => item.id === created.id));
});

test('GET barang status invalid → 400', async () => {
  const cookie = await login();
  const { res } = await json('/api/barang?status=aneh', { headers: { cookie } });
  assert.equal(res.status, 400);
});

test('GET barang q= mencari potongan nama', async () => {
  const cookie = await login();
  await createBarang(cookie, { nama: 'Jagung', harga_retail: 12000 });
  await createBarang(cookie, { nama: 'Jaguar Asin', harga_retail: 8000 });
  await createBarang(cookie, { nama: 'Tepung', harga_retail: 11000 });

  const { body } = await json('/api/barang?q=jag', { headers: { cookie } });
  const names = body.data.map(item => item.nama);
  assert.ok(names.includes('Jagung'));
  assert.ok(names.includes('Jaguar Asin'));
  assert.ok(!names.includes('Tepung'));
});
