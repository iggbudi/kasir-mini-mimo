const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kasir-kasbon-'));
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

test('POST kasbon sukses', async () => {
  const cookie = await login();
  const { res, body } = await json('/api/kasbon', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({ nama: 'Budi', nominal: 100000 })
  });
  assert.equal(res.status, 200);
  assert.equal(body.data.sisa, 100000);
  assert.equal(body.data.status, 'belum_lunas');
});

test('POST kasbon bayar melebihi sisa ditolak', async () => {
  const cookie = await login();
  const kas = await json('/api/kasbon', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({ nama: 'Andi', nominal: 50000 })
  });
  const id = kas.body.data.id;

  const { res, body } = await json(`/api/kasbon/${id}/bayar`, {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({ bayar: 60000 })
  });
  assert.equal(res.status, 400);
});

test('POST kasbon bayar = sisa → lunas', async () => {
  const cookie = await login();
  const kas = await json('/api/kasbon', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({ nama: 'Citra', nominal: 30000 })
  });
  const id = kas.body.data.id;

  const bayarRes = await json(`/api/kasbon/${id}/bayar`, {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({ bayar: 30000 })
  });
  assert.equal(bayarRes.res.status, 200);
  assert.equal(bayarRes.body.data.kasbon.status, 'lunas');
  assert.equal(bayarRes.body.data.kasbon.sisa, 0);
});

test('GET kasbon default hanya belum_lunas', async () => {
  const cookie = await login();
  const { res, body } = await json('/api/kasbon', { headers: { cookie } });
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(body.data));
});
